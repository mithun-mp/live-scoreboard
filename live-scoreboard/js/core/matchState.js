/* Centralized matchState manager
   - Controller imports this and mutates state via well-defined API
   - Display listens (via sync) but MUST NOT mutate this object
   - Why separate: single source of truth makes syncing predictable and auditable
*/

const MatchState = (function (Utils) {
  // Private per-instance factory (we may support multiple matchIds in future)
  // Create a match state instance. IMPORTANT: pass a `sync` instance
  // created via `Sync.create(matchId, role)` so the state can broadcast
  // updates. We avoid any module-level Sync globals to keep boot order flexible.
  function create(matchId, initial, sync) {
    if (!matchId) throw new Error('matchId required');
    // initial state skeleton with defensive defaults
    const initialState = {
      matchId,
      teams: { home: { name: 'Home', id: 'home' }, away: { name: 'Away', id: 'away' } },
      score: { home: 0, away: 0 },
      timer: { running: false, elapsedMs: 0, lastStartTs: null, pausedAt: null },
      period: '1st Half', // 'HT', '2nd Half', 'FT', 'ET'
      events: [], // { id, type: 'goal'|'sub', team, player, ts, meta }
      uiFlags: { showGoalOverlay: false },
      version: 0, // increment on each authoritative change
      updatedAt: Utils.nowTs()
    };

    let state = Utils.deepMerge(initialState, initial || {});
    const originId = Utils.uuid();
    const seenMessageIds = new Set();

    // Internal helper: create new versioned state snapshot
    function snapshotWithMeta(patch) {
      const next = Utils.deepMerge(state, patch || {});
      next.version = (state.version || 0) + 1;
      next.updatedAt = Utils.nowTs();
      return next;
    }

    // Public API
    return {
      getState() {
        // Return a deep copy to avoid accidental mutations by callers
        return JSON.parse(JSON.stringify(state));
      },

      // Apply a patch locally and broadcast it.
      // Controller should use actions (higher-level) which call this.
      setStatePatch(patch) {
        if (!Utils.isObject(patch)) return;
        const newState = snapshotWithMeta(patch);
        state = newState;
        // Broadcast authoritative state to other pages
        try {
          if (sync && typeof sync.broadcast === 'function') {
            sync.broadcast({
              messageId: Utils.uuid(),
              originId,
              originRole: 'controller',
              matchId,
              type: 'state',
              version: state.version,
              payload: state,
              ts: Utils.nowTs()
            });
          }
        } catch (err) {
          console.error('sync broadcast failed', err);
        }
      },

      // Higher-level actions (examples)
      recordGoal(team, playerName, extra = {}) {
        // pseudo-code:
        //  - create goal event {id, type:'goal', team, player, ts}
        //  - increment score for team
        //  - push to events[]
        //  - toggle uiFlags.showGoalOverlay true briefly (controller-only)
        //  - setStatePatch(...) to broadcast
        if (!team) return;
        const event = {
          id: Utils.uuid(),
          type: 'goal',
          team,
          player: playerName || null,
          ts: Utils.nowTs(),
          meta: extra
        };
        const newScore = { ...state.score };
        if (team === 'home' || team === state.teams.home.id) newScore.home += 1;
        else newScore.away += 1;
        this.setStatePatch({
          score: newScore,
          events: (state.events || []).concat(event),
          uiFlags: Utils.deepMerge(state.uiFlags || {}, { showGoalOverlay: true })
        });
      },

      undoLastGoal() {
        // pseudo-code:
        // - find last goal event
        // - remove it and decrement score safely
        // - setStatePatch(...)
        const events = (state.events || []).slice();
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].type === 'goal') {
            const ev = events.splice(i, 1)[0];
            const newScore = { ...state.score };
            if (ev.team === 'home' || ev.team === state.teams.home.id) newScore.home = Math.max(0, newScore.home - 1);
            else newScore.away = Math.max(0, newScore.away - 1);
            this.setStatePatch({ score: newScore, events });
            return;
          }
        }
        // nothing to undo
      },

      startTimer() {
        if (state.timer.running) return;
        const lastStart = Utils.nowTs();
        this.setStatePatch({
          timer: {
            running: true,
            lastStartTs: lastStart,
            pausedAt: null,
            elapsedMs: state.timer.elapsedMs || 0
          }
        });
      },

      pauseTimer() {
        if (!state.timer.running) return;
        // compute elapsed
        const now = Utils.nowTs();
        const lastStart = state.timer.lastStartTs || now;
        const elapsed = (state.timer.elapsedMs || 0) + (now - lastStart);
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
        this.setStatePatch({
          timer: { running: false, lastStartTs: null, pausedAt: null, elapsedMs: 0 }
        });
      }
      ,

      // Apply a remote authoritative state without rebroadcasting.
      // Used when receiving state messages from another controller on startup/recovery.
      applyRemote(remoteState, meta) {
        if (!remoteState || typeof remoteState.version !== 'number') return;
        if (remoteState.matchId !== matchId) return;
        // Ignore stale updates
        if (remoteState.version <= (state.version || 0)) return;
        // Prevent replay via messageId if provided
        if (meta && meta.messageId) {
          if (seenMessageIds.has(meta.messageId)) return;
          seenMessageIds.add(meta.messageId);
        }
        // Replace local snapshot with remote one (defensive copy)
        state = JSON.parse(JSON.stringify(remoteState));
      }
    };
  }

  return { create };
})(Utils);