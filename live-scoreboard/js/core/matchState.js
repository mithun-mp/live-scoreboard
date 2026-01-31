/* Centralized MatchState manager (DEBUG-ENHANCED)
   ------------------------------------------------
   - Single source of truth (controller authoritative)
   - Display must NEVER mutate
   - Sync-safe, replay-safe, auditable
*/

const MatchState = (function (Utils) {

  function log(...args) {
    console.log('[MatchState]', ...args);
  }
  function warn(...args) {
    console.warn('[MatchState]', ...args);
  }
  function error(...args) {
    console.error('[MatchState]', ...args);
  }

  function create(matchId, initial, sync) {
    if (!matchId) {
      error('create() failed → matchId missing');
      throw new Error('matchId required');
    }

    log('Initializing MatchState', { matchId });

    /* ------------------------------
       Base State
    --------------------------------*/
    const baseState = {
      matchId,
      teams: {
        home: { name: 'Home', id: 'home' },
        away: { name: 'Away', id: 'away' }
      },
      score: { home: 0, away: 0 },
      timer: { running: false, elapsedMs: 0, lastStartTs: null, pausedAt: null },
      period: 'PRE_MATCH',
      events: [],
      uiFlags: { showGoalOverlay: false },
      version: 0,
      updatedAt: Utils.nowTs()
    };

    const persistKey = `live-scoreboard:${matchId}:snapshot`;
    let recovered = null;

    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) {
        recovered = JSON.parse(raw);
        log('Recovered persisted snapshot', recovered.version);
      }
    } catch (e) {
      warn('Snapshot recovery failed', e);
    }

    let state = Utils.deepMerge(baseState, recovered || {});
    state = Utils.deepMerge(state, initial || {});

    /* ------------------------------
       State Machine
    --------------------------------*/
    const STATES = {
      PRE_MATCH: 'PRE_MATCH',
      COUNTDOWN: 'COUNTDOWN',
      FIRST_HALF: 'FIRST_HALF',
      HALF_TIME: 'HALF_TIME',
      SECOND_HALF: 'SECOND_HALF',
      FULL_TIME: 'FULL_TIME'
    };

    const ALLOWED = {
      PRE_MATCH: ['COUNTDOWN', 'FIRST_HALF'],
      COUNTDOWN: ['FIRST_HALF', 'PRE_MATCH'],
      FIRST_HALF: ['HALF_TIME', 'SECOND_HALF', 'FULL_TIME'],
      HALF_TIME: ['SECOND_HALF'],
      SECOND_HALF: ['FULL_TIME'],
      FULL_TIME: []
    };

    function normalizePeriod(p) {
      if (!p) return STATES.PRE_MATCH;
      const s = String(p).toUpperCase();
      if (s.includes('1') || s.includes('FIRST')) return STATES.FIRST_HALF;
      if (s.includes('HT') || s.includes('HALF')) return STATES.HALF_TIME;
      if (s.includes('2') || s.includes('SECOND')) return STATES.SECOND_HALF;
      if (s.includes('FULL') || s.includes('FT')) return STATES.FULL_TIME;
      if (s.includes('COUNT')) return STATES.COUNTDOWN;
      return STATES.PRE_MATCH;
    }

    state.period = normalizePeriod(state.period);

    const originId = Utils.uuid();
    const seenMessageIds = new Set();

    function canTransition(from, to) {
      return ALLOWED[from] && ALLOWED[from].includes(to);
    }

    function persistSnapshot(s) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(s));
        log('Snapshot persisted', s.version);
      } catch (e) {
        warn('Snapshot persist failed', e);
      }
    }

    function nextSnapshot(patch) {
      const next = Utils.deepMerge(state, patch || {});
      next.version = (state.version || 0) + 1;
      next.updatedAt = Utils.nowTs();
      return next;
    }

    /* ------------------------------
       Public API
    --------------------------------*/
    return {

      getState() {
        return JSON.parse(JSON.stringify(state));
      },

      setStatePatch(patch) {
        if (!Utils.isObject(patch)) return;

        if (patch.period) {
          const desired = normalizePeriod(patch.period);
          if (desired !== state.period && !canTransition(state.period, desired)) {
            warn('Illegal transition blocked', state.period, '→', desired);
            return;
          }
          patch.period = desired;
        }

        state = nextSnapshot(patch);

        log('State updated', {
          version: state.version,
          period: state.period,
          score: state.score
        });

        if (sync && sync.broadcast) {
          try {
            sync.broadcast({
              type: 'state',
              version: state.version,
              payload: state
            });
          } catch (e) {
            error('Sync broadcast failed', e);
          }
        }

        persistSnapshot(state);
      },

      /* -------- Actions -------- */

      recordGoal(team, player, meta = {}) {
        if (!team) return;

        const ev = {
          id: Utils.uuid(),
          type: 'goal',
          team,
          player: player || null,
          ts: Utils.nowTs(),
          meta
        };

        const score = { ...state.score };
        team === 'home' ? score.home++ : score.away++;

        log('Goal recorded', team, player);

        this.setStatePatch({
          score,
          events: state.events.concat(ev),
          uiFlags: { ...state.uiFlags, showGoalOverlay: true }
        });
      },

      undoLastGoal() {
        const events = state.events.slice();

        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].type === 'goal') {
            const ev = events.splice(i, 1)[0];
            const score = { ...state.score };
            ev.team === 'home' ? score.home-- : score.away--;
            log('Undo goal', ev);
            this.setStatePatch({ score, events });
            return;
          }
        }

        warn('Undo requested but no goal found');
      },

      transitionTo(next) {
        const desired = normalizePeriod(next);
        if (desired !== state.period && !canTransition(state.period, desired)) {
          warn('Transition blocked', state.period, '→', desired);
          return;
        }
        log('Transition', state.period, '→', desired);
        this.setStatePatch({ period: desired });
      },

      startTimer() {
        if (state.timer.running) return;
        if (![STATES.FIRST_HALF, STATES.SECOND_HALF].includes(state.period)) {
          warn('Timer start blocked (invalid period)', state.period);
          return;
        }

        log('Timer started');
        this.setStatePatch({
          timer: {
            running: true,
            lastStartTs: Utils.nowTs(),
            pausedAt: null,
            elapsedMs: state.timer.elapsedMs
          }
        });
      },

      pauseTimer() {
        if (!state.timer.running) return;

        const now = Utils.nowTs();
        const elapsed = state.timer.elapsedMs + (now - state.timer.lastStartTs);

        log('Timer paused', elapsed);

        this.setStatePatch({
          timer: {
            running: false,
            lastStartTs: null,
            pausedAt: now,
            elapsedMs: elapsed
          }
        });
      },

      resetTimer() {
        log('Timer reset');
        this.setStatePatch({
          timer: { running: false, elapsedMs: 0, lastStartTs: null, pausedAt: null }
        });
      },

      applyRemote(remote, meta) {
        if (!remote || remote.matchId !== matchId) return;
        if (remote.version <= state.version) {
          log('Remote state ignored (stale)', remote.version);
          return;
        }

        if (meta?.messageId && seenMessageIds.has(meta.messageId)) return;
        if (meta?.messageId) seenMessageIds.add(meta.messageId);

        log('Remote state applied', remote.version);
        state = JSON.parse(JSON.stringify(remote));
      }
    };
  }

  return { create };
})(Utils);

try {
  window.MatchState = window.MatchState || MatchState;
  console.info('[MatchState] Global export ready');
} catch {}