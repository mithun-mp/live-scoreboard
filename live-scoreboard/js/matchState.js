/* MatchState – Authoritative Match Logic */
window.MatchState = (function () {
  const Utils = window.Utils;

  function create(matchId, initialData, sync) {
    // Default State
    const state = {
      teams: {
        home: { name: "Home" },
        away: { name: "Away" },
      },
      score: { home: 0, away: 0 },
      period: "PRE_MATCH", // PRE_MATCH, FIRST_HALF, HALF_TIME, SECOND_HALF, ADDED_TIME, FULL_TIME
      timer: {
        running: false,
        baseMs: 0,      // Time accumulated before the current run segment
        startTs: null,  // Timestamp when the current run segment started
      },
      matchDurationMs: 90 * 60 * 1000,
      extraTimeMs: 0,
      goalHistory: [],
      subHistory: [],
      periodHistory: [], // Stack for period transitions
      lastEvent: null, // { type: 'goal'|'sub', id: uuid, ... } for UI triggers
    };

    if (initialData) {
      Utils.deepMerge(state, initialData);
    }

    let intervalId = null;

    // ------------------ HELPERS ------------------
    function getElapsedMs() {
      if (!state.timer.running) return state.timer.baseMs;
      return state.timer.baseMs + (Date.now() - state.timer.startTs);
    }

    function pushPeriodHistory() {
        // Snapshot relevant state for period undo
        state.periodHistory.push({
            period: state.period,
            timer: Utils.deepClone(state.timer),
            timestamp: Date.now()
        });
        // Limit history size
        if (state.periodHistory.length > 10) state.periodHistory.shift();
    }

    function broadcast() {
      // We inject the *current* calculated elapsed time into the broadcast
      // so displays don't have to calculate it immediately, but they should
      // use startTs for their own high-res timers.
      const broadcastState = Utils.deepClone(state);
      const elapsed = getElapsedMs();
      const halfMs = state.matchDurationMs / 2;
      let thresholdMs = 0;
      if (state.period === "FIRST_HALF") thresholdMs = halfMs;
      else if (state.period === "SECOND_HALF" || state.period === "FULL_TIME" || state.period === "ADDED_TIME") thresholdMs = state.matchDurationMs;
      else thresholdMs = elapsed;
      const mainElapsed = Math.min(elapsed, thresholdMs);
      const extraElapsed = Math.max(0, elapsed - thresholdMs);
      broadcastState.derived = {
        elapsedMs: elapsed,
        thresholdMs,
        mainElapsed,
        extraElapsed,
        addedTimeMin: Math.floor((state.extraTimeMs || 0) / 60000)
      };
      try { Utils.debug('matchState:broadcast', { period: state.period, score: `${state.score.home}-${state.score.away}` }); } catch {}
      sync.broadcast(broadcastState);
    }

    function changePeriod(newPeriod) {
        if (state.period === newPeriod) return;
        pushPeriodHistory();
        state.period = newPeriod;
    }

    // ------------------ TIMER ------------------
    function startTimer() {
      if (state.timer.running) return;
      state.timer.running = true;
      state.timer.startTs = Date.now();
      try { Utils.debug('matchState:startTimer', { baseMs: state.timer.baseMs }); } catch {}
      
      if (!intervalId) {
        intervalId = setInterval(tick, 500);
      }
      broadcast();
    }

    function pauseTimer() {
      if (!state.timer.running) return;
      
      // Accumulate the elapsed time
      state.timer.baseMs += Date.now() - state.timer.startTs;
      state.timer.running = false;
      state.timer.startTs = null;
      try { Utils.debug('matchState:pauseTimer', { baseMs: state.timer.baseMs }); } catch {}
      
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      broadcast();
    }

    function resetTimer() {
      pauseTimer();
      state.timer.baseMs = 0;
      broadcast();
    }

    function setTimer(ms) {
      const wasRunning = state.timer.running;
      if (wasRunning) pauseTimer();
      state.timer.baseMs = ms;
      try { Utils.debug('matchState:setTimer', { baseMs: ms }); } catch {}
      if (wasRunning) startTimer();
      else broadcast();
    }

    // ------------------ ENGINE (TICK) ------------------
    function tick() {
      const elapsed = getElapsedMs();
      
      // We can also broadcast periodically to ensure sync
      if (Math.random() < 0.1) broadcast();
    }

    // ------------------ PERIODS ------------------
    function setPeriod(p) {
      changePeriod(p);
      try { Utils.debug('matchState:setPeriod', { period: p }); } catch {}
      broadcast();
    }

    function undoLastPeriod() {
        const prev = state.periodHistory.pop();
        if (prev) {
            state.period = prev.period;
            state.timer = Utils.deepClone(prev.timer);
            broadcast();
        }
    }

    function startFirstHalf() {
      changePeriod("FIRST_HALF");
      state.timer.baseMs = 0;
      try { Utils.debug('matchState:startFirstHalf'); } catch {}
      startTimer();
    }

    function startSecondHalf() {
      changePeriod("SECOND_HALF");
      // Reset timer to exact start of second half (e.g., 45:00)
      state.timer.baseMs = state.matchDurationMs / 2;
      try { Utils.debug('matchState:startSecondHalf', { baseMs: state.timer.baseMs }); } catch {}
      startTimer();
    }

    function autoStart() {
        if (state.period === "PRE_MATCH") {
            startFirstHalf();
        }
    }

    // ------------------ GOALS ------------------
    function recordGoal(team, scorerName) {
      if (!["home", "away"].includes(team)) return;
      
      const elapsed = getElapsedMs();
      const minute = Math.ceil(elapsed / 60000) || 1;
      
      state.score[team]++;
      
      const goal = {
        id: Utils.uuid(),
        team,
        scorer: scorerName || "Unknown",
        timeMs: elapsed,
        minute: minute,
        period: state.period,
        timestamp: Date.now()
      };
      
      state.goalHistory.push(goal);
      state.lastEvent = { type: 'goal', data: goal, id: goal.id };
      try { Utils.debug('matchState:goal', { team, scorer: goal.scorer, minute }); } catch {}
      
      broadcast();
    }

    function undoLastGoal() {
      const last = state.goalHistory.pop();
      if (!last) return;
      
      if (state.score[last.team] > 0) {
        state.score[last.team]--;
      }
      broadcast();
    }

    // ------------------ SUBS ------------------
    function recordSub(team, type, inName, outName) {
       const elapsed = getElapsedMs();
       const minute = Math.ceil(elapsed / 60000) || 1;
       
       const sub = {
         id: Utils.uuid(),
         team,
         type, // 'IN' or 'OUT' (or we can combine)
         inName,
         outName,
         timeMs: elapsed,
         minute: minute,
         period: state.period,
         timestamp: Date.now()
       };
       
       state.subHistory.push(sub);
       state.lastEvent = { type: 'sub', data: sub, id: sub.id };
       try { Utils.debug('matchState:sub', { team, inName, outName, minute }); } catch {}
       
       broadcast();
    }
    
    function undoLastSub() {
        state.subHistory.pop();
        broadcast();
    }

    // ------------------ EXTRA TIME ------------------
    function setExtraTime(minutes) {
      state.extraTimeMs = minutes * 60 * 1000;
      broadcast();
    }

    // ------------------ GENERIC ------------------
    function setStatePatch(patch) {
      Utils.deepMerge(state, patch);
      try { Utils.debug('matchState:setStatePatch', { keys: Object.keys(patch || {}) }); } catch {}
      broadcast();
    }

    function getState() {
      // return state with derived elapsed time
      const s = Utils.deepClone(state);
      s.derived = { elapsedMs: getElapsedMs() };
      return s;
    }

    return {
      getState,
      setStatePatch,
      
      // Timer
      startTimer,
      pauseTimer,
      resetTimer,
      setTimer,
      
      // Periods
      setPeriod,
      startFirstHalf,
      startSecondHalf,
      
      // Events
      recordGoal,
      undoLastGoal,
      recordSub,
      undoLastSub,
      setExtraTime,
      undoLastPeriod
    };
  }

  return { create };
})();
