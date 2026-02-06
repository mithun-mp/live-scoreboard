/* Match Status UI — Display Page (STABLE LIVE CLOCK) */
(function () {
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId") || "local";

  const channel =
    "BroadcastChannel" in window
      ? new BroadcastChannel(`match-${matchId}`)
      : null;

  const el = {
    homeName: document.getElementById("teamAName"),
    awayName: document.getElementById("teamBName"),
    homeScore: document.getElementById("scoreHome"),
    awayScore: document.getElementById("scoreAway"),
    period: document.getElementById("period"),
    timer: document.getElementById("timer"),
    extraTime: document.getElementById("extraTime"),
    homeLogo: document.getElementById("teamAImg"),
    awayLogo: document.getElementById("teamBImg"),
  };

  let currentState = null;
  let timerLoop = null;
  let lastTick = Date.now();
  let lastRenderedGoalId = null;
  let lastRenderedSubId = null;

  /* ---------------- TIMER FORMAT ---------------- */

  function formatMs(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const min = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const sec = String(totalSeconds % 60).padStart(2, "0");
    return `${min}:${sec}`;
  }

  /* ---------------- PERIOD LABEL ---------------- */

  function periodLabel(p) {
    switch (p) {
      case "FIRST_HALF":
        return "First Half";
      case "HALF_TIME":
        return "Half Time";
      case "SECOND_HALF":
        return "Second Half";
      case "FULL_TIME":
        return "Full Time";
      default:
        return "";
    }
  }

  /* ---------------- VISUAL ANIMATIONS ---------------- */

  function animateGoal(team) {
    const target = team === "home" ? el.homeScore : el.awayScore;
    target.classList.add("goal-flash");
    setTimeout(() => target.classList.remove("goal-flash"), 900);
  }

  function showSubOverlay(team, type) {
    const overlay = document.createElement("div");
    overlay.className = "sub-overlay";

    overlay.textContent =
      (team === "home"
        ? el.homeName.textContent
        : el.awayName.textContent) +
      " SUB " +
      type;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 20);
    setTimeout(() => overlay.remove(), 2200);
  }

  /* ---------------- LOCAL CLOCK ENGINE ---------------- */

  function startLocalClock() {
    if (timerLoop) return;

    timerLoop = setInterval(() => {
      if (!currentState) return;
      if (!currentState.timer.running) return;

      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      currentState.timer.elapsedMs += delta;

      el.timer.textContent = formatMs(currentState.timer.elapsedMs);
    }, 1000);
  }

  /* ---------------- RENDER ---------------- */

  function renderState(state) {
    if (!state) return;

    currentState = JSON.parse(JSON.stringify(state));
    lastTick = Date.now();

    el.homeName.textContent = state.teams.home.name;
    el.awayName.textContent = state.teams.away.name;

    el.homeScore.textContent = state.score.home;
    el.awayScore.textContent = state.score.away;

    el.period.textContent = periodLabel(state.period);
    el.timer.textContent = formatMs(state.timer.elapsedMs || 0);
    el.extraTime.textContent = (state.extraTime / 60000) | 0;

    try {
      const homeLogo = localStorage.getItem(`${matchId}:homeLogo`);
      const awayLogo = localStorage.getItem(`${matchId}:awayLogo`);
      if (homeLogo) el.homeLogo.src = homeLogo;
      if (awayLogo) el.awayLogo.src = awayLogo;
    } catch {}

    if (state.lastGoal && state.lastGoal.id !== lastRenderedGoalId) {
      lastRenderedGoalId = state.lastGoal.id;
      animateGoal(state.lastGoal.team);
    }

    if (state.lastSub && state.lastSub.id !== lastRenderedSubId) {
      lastRenderedSubId = state.lastSub.id;
      showSubOverlay(state.lastSub.team, state.lastSub.type);
    }

    startLocalClock();
  }

  /* ---------------- SYNC ---------------- */

  channel?.addEventListener("message", (ev) => {
    const msg = ev.data;
    if (!msg?.payload?.state) return;
    renderState(msg.payload.state);
  });

  setInterval(() => {
    const saved = localStorage.getItem(`${matchId}:state`);
    if (!saved) return;
    try {
      renderState(JSON.parse(saved).state);
    } catch {}
  }, 1000);

  /* ---------------- INIT ---------------- */

  document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem(`${matchId}:state`);
    if (saved) {
      try {
        renderState(JSON.parse(saved).state);
      } catch {}
    }
  });
})();