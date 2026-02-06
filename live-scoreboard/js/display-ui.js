/* Display UI – Live Scoreboard */
(function () {
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId") || "local";

  const Utils = window.Utils;
  const SyncLib = window.Sync;
  const MatchStateFactory = window.MatchState;

  if (!Utils || !SyncLib || !MatchStateFactory) {
    console.error("Display dependencies missing");
    return;
  }

  const sync = SyncLib.create(matchId, "display");
  const match = MatchStateFactory.create(matchId, null, sync);

  const channel =
    "BroadcastChannel" in window
      ? new BroadcastChannel(`match-${matchId}`)
      : null;

  // ------------------ DOM ------------------
  const bind = (k) => document.querySelector(`[data-bind="${k}"]`);
  const scoreHomeEl = bind("score-home");
  const scoreAwayEl = bind("score-away");
  const timerEl = bind("timer");
  const periodEl = bind("period");
  const homeNameEl = bind("team-home-name");
  const awayNameEl = bind("team-away-name");
  const homeLogoEl = document.getElementById("displayLogoHome");
  const awayLogoEl = document.getElementById("displayLogoAway");
  const eventsContainer = document.querySelector(".event-animations");

  // ------------------ RENDER STATE ------------------
  function renderState(state) {
    if (!state) return;

    homeNameEl.textContent = state.teams.home.name;
    awayNameEl.textContent = state.teams.away.name;
    scoreHomeEl.textContent = state.score.home;
    scoreAwayEl.textContent = state.score.away;
    timerEl.textContent = Utils.formatMs(state.timer.elapsedMs || 0);
    periodEl.textContent = state.period;

    // Goal flash animation
    if (state.lastGoal) {
      const team = state.lastGoal.team;
      const scorer = state.lastGoal.scorer;
      const el = team === "home" ? scoreHomeEl : scoreAwayEl;
      el.classList.add("goal-flash");
      setTimeout(() => el.classList.remove("goal-flash"), 800);

      const confetti = document.createElement("div");
      confetti.className = "confetti";
      confetti.textContent = `GOAL! ${scorer}`;
      eventsContainer.appendChild(confetti);
      setTimeout(() => eventsContainer.removeChild(confetti), 2000);
    }

    // Substitution animation
    if (state.lastSub) {
      const { team, type, player } = state.lastSub;
      const subEl = document.createElement("div");
      subEl.className = "sub-event";
      subEl.textContent = `${team.toUpperCase()} ${type} → ${player || ""}`;
      eventsContainer.appendChild(subEl);
      setTimeout(() => eventsContainer.removeChild(subEl), 2000);
    }
  }

  // ------------------ LISTEN CHANNEL ------------------
  if (channel) {
    channel.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.type !== "STATE_SYNC") return;
      renderState(msg.payload.state);
    };
  }

  // ------------------ LOCALSTORAGE FALLBACK ------------------
  setInterval(() => {
    const stored = localStorage.getItem(`${matchId}:state`);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      renderState(parsed.state);
    } catch {}
  }, 1000);

  // ------------------ LOAD LOGOS ------------------
  function loadLogos() {
    try {
      const homeLogo = localStorage.getItem(`${matchId}:homeLogo`);
      const awayLogo = localStorage.getItem(`${matchId}:awayLogo`);
      if (homeLogo) homeLogoEl.src = homeLogo;
      if (awayLogo) awayLogoEl.src = awayLogo;
    } catch {}
  }

  // ------------------ AUTO TIMER ------------------
  function autoTimer() {
    const state = match.getState();
    if (!state.timer.running && state.period !== "PRE_MATCH") {
      match.startTimer();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadLogos();
    renderState(match.getState());
    autoTimer();
  });
})();