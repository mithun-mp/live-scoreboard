/* Controller UI – Full Feature Match Lifecycle */
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
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(`match-${matchId}`) : null;

  let halfDurationMs = 45 * 60 * 1000;
  let lastTick = Date.now();
  let halftimeOverlayActive = false;
  let lastGoalId = null;
  let lastSubId = null;

  /* ---------------- PERIOD LABEL ---------------- */
  function getPeriodLabel(period) {
    switch (period) {
      case "PRE_MATCH": return "Pre-Match";
      case "FIRST_HALF": return "First Half";
      case "HALF_TIME": return "Half Time";
      case "SECOND_HALF": return "Second Half";
      case "ADDED_TIME": return "Added Time";
      case "FULL_TIME": return "Full Time";
      default: return period;
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

    // Goal overlay
    if(state.lastGoal && state.lastGoal.id !== lastGoalId){
      lastGoalId = state.lastGoal.id;
      showGoalOverlay(state.lastGoal);
    }

    // Sub overlay
    if(state.lastSub && state.lastSub.id !== lastSubId){
      lastSubId = state.lastSub.id;
      showSubOverlay(state.lastSub.team, state.lastSub.type);
    }
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
    match.recordGoal(team, { scorer, team, timeMs: match.getState().timer.elapsedMs });
    broadcastState();
  }

  function showGoalOverlay(goal){
    const banner = document.createElement("div");
    banner.className = "goal-overlay";
    banner.textContent = `${goal.scorer} scored for ${goal.team.toUpperCase()}`;
    document.body.appendChild(banner);
    setTimeout(()=> banner.classList.add("show"), 20);
    setTimeout(()=> banner.classList.remove("show"), 2500);
    setTimeout(()=> banner.remove(), 3000);
  }

  /* ---------------- SUBSTITUTION ---------------- */
  function substitute(team, type){
    match.recordSubstitution(team, { team, type, timeMs: match.getState().timer.elapsedMs });
    broadcastState();
  }

  function showSubOverlay(team, type){
    const overlay = document.createElement("div");
    overlay.className = "sub-overlay";
    overlay.textContent = `${team.toUpperCase()} SUB ${type}`;
    document.body.appendChild(overlay);
    setTimeout(()=> overlay.classList.add("show"), 20);
    setTimeout(()=> overlay.remove(), 2200);
  }

  /* ---------------- TIMER ENGINE ---------------- */
  setInterval(() => {
    const state = match.getState();
    if(!state.timer.running) return;

    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;
    state.timer.elapsedMs += delta;

    const totalMs = state.matchDurationMs || halfDurationMs*2;

    if(state.period==="FIRST_HALF" && state.timer.elapsedMs>=halfDurationMs){
      state.timer.elapsedMs = halfDurationMs;
      match.pauseTimer();
      match.halftime();
      broadcastState();
      showHalftimeOverlay();
      return;
    }

    if(state.period==="SECOND_HALF" && state.timer.elapsedMs>=totalMs){
      state.timer.elapsedMs = totalMs;
      match.pauseTimer();
      match.startAddedTime();
      match.startTimer();
      broadcastState();
      return;
    }

    if(state.period==="ADDED_TIME" && state.timer.elapsedMs >= totalMs+(state.extraTime||0)){
      match.pauseTimer();
      match.endMatch();
      broadcastState();
      return;
    }

    broadcastState();
  }, 1000);

  /* ---------------- HALFTIME OVERLAY ---------------- */
  function showHalftimeOverlay(){
    if(halftimeOverlayActive) return;
    halftimeOverlayActive = true;
    const overlay = document.createElement("div");
    overlay.className = "halftime-overlay";
    overlay.textContent = "Halftime - Click to start 2nd Half";
    overlay.addEventListener("click", ()=>{
      match.startSecondHalf();
      lastTick = Date.now();
      match.startTimer();
      broadcastState();
      overlay.remove();
      halftimeOverlayActive = false;
    });
    document.body.appendChild(overlay);
  }

  /* ---------------- DOM BIND ---------------- */
  function bindDom(){
    const q = (a)=> document.querySelector(`[data-action="${a}"]`);
    q("goal-home")?.addEventListener("click", ()=>addGoal("home"));
    q("goal-away")?.addEventListener("click", ()=>addGoal("away"));
    q("undo")?.addEventListener("click", ()=>{
      match.undoLastGoal();
      broadcastState();
    });
    q("start-first-half")?.addEventListener("click", ()=>{
      match.startFirstHalf();
      match.resetTimer();
      lastTick = Date.now();
      match.startTimer();
      broadcastState();
    });
    q("start-second-half")?.addEventListener("click", ()=>{
      match.startSecondHalf();
      lastTick = Date.now();
      match.startTimer();
      broadcastState();
    });
    q("pause-timer")?.addEventListener("click", ()=>{
      match.pauseTimer();
      broadcastState();
    });
    q("end-match")?.addEventListener("click", ()=>{
      match.endMatch();
      match.pauseTimer();
      broadcastState();
    });
    q("add-extra-time")?.addEventListener("click", ()=>{
      const min = parseInt(prompt("Extra minutes"),10);
      if(!isNaN(min)){
        match.addExtraTime(min*60000);
        broadcastState();
      }
    });
    q("sub-in-home")?.addEventListener("click", ()=>substitute("home","IN"));
    q("sub-out-home")?.addEventListener("click", ()=>substitute("home","OUT"));
    q("sub-in-away")?.addEventListener("click", ()=>substitute("away","IN"));
    q("sub-out-away")?.addEventListener("click", ()=>substitute("away","OUT"));
  }

  /* ---------------- AUTO INIT ---------------- */
  function autoInit(){
    const state = match.getState();
    if(state.period==="PRE_MATCH"){
      match.startFirstHalf();
      match.resetTimer();
      lastTick = Date.now();
      match.startTimer();
    }
    broadcastState();
  }

  /* ---------------- INIT ---------------- */
  document.addEventListener("DOMContentLoaded", ()=>{
    loadSetup();
    bindDom();
    renderState(match.getState());
    autoInit();
  });

})();