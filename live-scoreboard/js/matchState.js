/* MatchState – Authoritative Match Logic */
window.MatchState = (function () {
  function create(matchId, initialData, sync) {
    const state = {
      teams: {
        home: { name: "Home" },
        away: { name: "Away" },
      },
      score: { home: 0, away: 0 },
      period: "PRE_MATCH", // PRE_MATCH, FIRST_HALF, HALF_TIME, SECOND_HALF, FULL_TIME
      timer: { elapsedMs: 0, running: false },
      matchDurationMs: 90 * 60 * 1000,
      extraTime: 0,
      goalHistory: [],
      substitutions: [],
    };

    if (initialData) {
      Object.assign(state, initialData);
    }

    let intervalId = null;

    // ------------------ TIMER ------------------
    function startTimer() {
      if (state.timer.running) return;
      state.timer.running = true;
      const startTs = Date.now() - state.timer.elapsedMs;

      intervalId = setInterval(() => {
        state.timer.elapsedMs = Date.now() - startTs;

        // AUTO HALF-TIME
        if (
          state.period === "FIRST_HALF" &&
          state.timer.elapsedMs >= state.matchDurationMs / 2
        ) {
          pauseTimer();
          state.period = "HALF_TIME";
        }

        // AUTO FULLTIME
        if (
          state.period === "SECOND_HALF" &&
          state.timer.elapsedMs >= state.matchDurationMs + state.extraTime
        ) {
          pauseTimer();
          state.period = "FULL_TIME";
        }

        // Broadcast every tick
        sync.broadcast(state);
      }, 500);
    }

    function pauseTimer() {
      if (!state.timer.running) return;
      state.timer.running = false;
      clearInterval(intervalId);
      intervalId = null;
      sync.broadcast(state);
    }

    function resetTimer() {
      state.timer.elapsedMs = 0;
      state.timer.running = false;
      clearInterval(intervalId);
      intervalId = null;
    }

    // ------------------ PERIODS ------------------
    function startFirstHalf() {
      state.period = "FIRST_HALF";
      state.timer.elapsedMs = 0;
      startTimer();
    }

    function halftime() {
      state.period = "HALF_TIME";
      pauseTimer();
    }

    function startSecondHalf() {
      state.period = "SECOND_HALF";
      // timer continues from end of first half
      startTimer();
    }

    function endMatch() {
      state.period = "FULL_TIME";
      pauseTimer();
    }

    // ------------------ GOALS ------------------
    function recordGoal(team, info) {
      if (!["home", "away"].includes(team)) return;
      state.score[team] += 1;
      state.goalHistory.push({ team, ...info });
      sync.broadcast(state);
    }

    function undoLastGoal() {
      const last = state.goalHistory.pop();
      if (!last) return;
      state.score[last.team] = Math.max(0, state.score[last.team] - 1);
      sync.broadcast(state);
    }

    // ------------------ EXTRA TIME ------------------
    function addExtraTime(ms) {
      state.extraTime += ms;
      sync.broadcast(state);
    }

    // ------------------ SUBSTITUTIONS ------------------
    function recordSubstitution(team, info) {
      state.substitutions.push({ team, ...info });
      sync.broadcast(state);
    }

    // ------------------ PATCH ------------------
    function setStatePatch(patch) {
      Object.assign(state, patch);
      sync.broadcast(state);
    }

    function getState() {
      return JSON.parse(JSON.stringify(state));
    }

    return {
      getState,
      startTimer,
      pauseTimer,
      resetTimer,
      startFirstHalf,
      halftime,
      startSecondHalf,
      endMatch,
      recordGoal,
      undoLastGoal,
      addExtraTime,
      recordSubstitution,
      setStatePatch,
    };
  }

  return { create };
})();