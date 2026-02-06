/* Controller UI – Match Lifecycle Integrated (STABLE TIMER ENGINE) */
(function () {
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId") || "local";

  const Utils = window.Utils;
  const SyncLib = window.Sync;
  const MatchStateFactory = window.MatchState;

  if (!Utils || !SyncLib || !MatchStateFactory) {
    console.error("Controller dependencies missing");
    return;
  }

  const sync = SyncLib.create(matchId, "controller");
  const match = MatchStateFactory.create(matchId, null, sync);

  const channel =
    "BroadcastChannel" in window
      ? new BroadcastChannel(`match-${matchId}`)
      : null;

  let halfDurationMs = 45 * 60 * 1000;
  let lastTick = Date.now();

  /* ---------------- PERIOD LABELS ---------------- */

  function getPeriodLabel(period) {
    switch (period) {
      case "PRE_MATCH":
        return "Pre-Match";
      case "FIRST_HALF":
        return "First Half";
      case "HALF_TIME":
        return "Half Time";
      case "SECOND_HALF":
        return "Second Half";
      case "ADDED_TIME":
        return "Added Time";
      case "FULL_TIME":
        return "Full Time";
      default:
        return period;
    }
  }

  /* ---------------- SETUP LOAD ---------------- */

  function loadSetup() {
    try {
      const setup = JSON.parse(localStorage.getItem(`${matchId}:setup`));
      if (!setup) return;

      const totalMs = (setup.matchDuration || 90) * 60 * 1000;
      halfDurationMs = totalMs / 2;

      match.setStatePatch({
        teams: {
          home: { ...match.getState().teams.home, ...setup.teamA },
          away: { ...match.getState().teams.away, ...setup.teamB },
        },
        matchDurationMs: totalMs,
      });
    } catch (e) {
      console.warn("Setup load failed", e);
    }
  }

  /* ---------------- RENDER ---------------- */

  function renderState(state) {
    const bind = (k) => document.querySelector(`[data-bind="${k}"]`);
    if (!state) return;

    bind("team-home-name").textContent = state.teams.home.name;
    bind("team-away-name").textContent = state.teams.away.name;
    bind("score-home").textContent = state.score.home;
    bind("score-away").textContent = state.score.away;

    bind("period").textContent = getPeriodLabel(state.period);
    bind("timer").textContent = Utils.formatMs(state.timer.elapsedMs);

    const dbg = document.getElementById("matchStateDebug");
    if (dbg) dbg.textContent = JSON.stringify(state, null, 2);
  }

  /* ---------------- BROADCAST ---------------- */

  function broadcastState() {
    const state = match.getState();

    channel?.postMessage({ type: "STATE_SYNC", payload: { state } });
    localStorage.setItem(`${matchId}:state`, JSON.stringify({ state }));

    renderState(state);
  }

  /* ---------------- GOALS ---------------- */

  function addGoal(team) {
    const teamName = match.getState().teams[team].name;
    const scorer = prompt(`Scorer for ${teamName}`) || "Unknown";

    match.recordGoal(team, {
      scorer,
      team,
      timeMs: match.getState().timer.elapsedMs,
    });

    broadcastState();
  }

  /* ---------------- SUBSTITUTION ---------------- */

  function substitute(team, type) {
    match.recordSubstitution(team, {
      team,
      type,
      timeMs: match.getState().timer.elapsedMs,
    });

    broadcastState();
  }

  /* ---------------- TIMER ENGINE ---------------- */

  setInterval(() => {
    const state = match.getState();
    if (!state.timer.running) return;

    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    state.timer.elapsedMs += delta;

    const fullDuration = state.matchDurationMs || halfDurationMs * 2;

    /* FIRST HALF END */
    if (
      state.period === "FIRST_HALF" &&
      state.timer.elapsedMs >= halfDurationMs
    ) {
      state.timer.elapsedMs = halfDurationMs;
      match.pauseTimer();
      match.halftime();
      broadcastState();
      return;
    }

    /* SECOND HALF END */
    if (
      state.period === "SECOND_HALF" &&
      state.timer.elapsedMs >= fullDuration
    ) {
      state.timer.elapsedMs = fullDuration;
      match.pauseTimer();
      match.startAddedTime();
      match.startTimer();
      broadcastState();
      return;
    }

    /* ADDED TIME END */
    if (
      state.period === "ADDED_TIME" &&
      state.timer.elapsedMs >= fullDuration + (state.extraTime || 0)
    ) {
      match.pauseTimer();
      match.endMatch();
      broadcastState();
      return;
    }

    broadcastState();
  }, 1000);

  /* ---------------- DOM BIND ---------------- */

  function bindDom() {
    const q = (a) => document.querySelector(`[data-action="${a}"]`);

    q("goal-home")?.addEventListener("click", () => addGoal("home"));
    q("goal-away")?.addEventListener("click", () => addGoal("away"));

    q("undo")?.addEventListener("click", () => {
      match.undoLastGoal();
      broadcastState();
    });

    q("start-timer")?.addEventListener("click", () => {
      match.startTimer();
      lastTick = Date.now();
      broadcastState();
    });

    q("pause-timer")?.addEventListener("click", () => {
      match.pauseTimer();
      broadcastState();
    });

    q("start-second-half")?.addEventListener("click", () => {
      match.startSecondHalf();
      lastTick = Date.now();
      match.startTimer();
      broadcastState();
    });

    q("half-time")?.addEventListener("click", () => {
      match.halftime();
      match.pauseTimer();
      broadcastState();
    });

    q("end-match")?.addEventListener("click", () => {
      match.endMatch();
      match.pauseTimer();
      broadcastState();
    });

    q("add-extra-time")?.addEventListener("click", () => {
      const min = parseInt(prompt("Extra minutes"), 10);
      if (!isNaN(min)) {
        match.addExtraTime(min * 60000);
        broadcastState();
      }
    });

    q("sub-in-home")?.addEventListener("click", () =>
      substitute("home", "IN")
    );
    q("sub-out-home")?.addEventListener("click", () =>
      substitute("home", "OUT")
    );
    q("sub-in-away")?.addEventListener("click", () =>
      substitute("away", "IN")
    );
    q("sub-out-away")?.addEventListener("click", () =>
      substitute("away", "OUT")
    );
  }

  /* ---------------- AUTO INIT ---------------- */

  function autoInit() {
    const state = match.getState();

    if (state.period === "PRE_MATCH") {
      match.startFirstHalf();
      match.resetTimer();
      lastTick = Date.now();
      match.startTimer();
    }

    broadcastState();
  }

  /* ---------------- INIT ---------------- */

  document.addEventListener("DOMContentLoaded", () => {
    loadSetup();
    bindDom();
    renderState(match.getState());
    autoInit();
  });
})();