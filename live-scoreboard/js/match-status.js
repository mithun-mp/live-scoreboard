/* Match Status UI – Full Feature Display Page */
(function () {
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId") || "local";

  const channel = "BroadcastChannel" in window ? new BroadcastChannel(`match-${matchId}`) : null;

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
  let lastGoalId = null;
  let lastSubId = null;

  /* ---------------- TIMER FORMAT ---------------- */
  function formatMs(ms, showExtra = false, extra = 0) {
    const totalSeconds = Math.floor(ms / 1000);
    let min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    if (showExtra && extra > 0) min = `${min} + ${extra}`;
    return `${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  }

  /* ---------------- PERIOD LABEL ---------------- */
  function periodLabel(p){
    switch(p){
      case "PRE_MATCH": return "Pre-Match";
      case "FIRST_HALF": return "First Half";
      case "HALF_TIME": return "Half Time";
      case "SECOND_HALF": return "Second Half";
      case "ADDED_TIME": return "Added Time";
      case "FULL_TIME": return "Full Time";
      default: return p;
    }
  }

  /* ---------------- ANIMATIONS ---------------- */
  function showGoalOverlay(goal){
    const banner = document.createElement("div");
    banner.className = "goal-overlay";
    banner.textContent = `${goal.scorer} scored for ${goal.team.toUpperCase()}`;
    document.body.appendChild(banner);
    setTimeout(()=> banner.classList.add("show"), 20);
    setTimeout(()=> banner.classList.remove("show"), 2500);
    setTimeout(()=> banner.remove(), 3000);
  }

  function showSubOverlay(team, type){
    const overlay = document.createElement("div");
    overlay.className = "sub-overlay";
    overlay.textContent = `${team.toUpperCase()} SUB ${type}`;
    document.body.appendChild(overlay);
    setTimeout(()=> overlay.classList.add("show"), 20);
    setTimeout(()=> overlay.remove(), 2200);
  }

  function showHalftimeOverlay(){
    const overlay = document.createElement("div");
    overlay.className = "halftime-overlay";
    overlay.textContent = "Halftime - Click to start 2nd Half";
    overlay.addEventListener("click", ()=>{
      currentState.period = "SECOND_HALF";
      currentState.timer.running = true;
      lastTick = Date.now();
      overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function animateGoal(team){
    const target = team==="home"? el.homeScore: el.awayScore;
    target.classList.add("goal-flash");
    setTimeout(()=> target.classList.remove("goal-flash"),900);
  }

  /* ---------------- LOCAL CLOCK ---------------- */
  function startLocalClock(){
    if(timerLoop) return;
    timerLoop = setInterval(()=>{
      if(!currentState || !currentState.timer.running) return;

      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      currentState.timer.elapsedMs += delta;

      const extraMin = currentState.extraTime ? currentState.extraTime/60000 : 0;
      el.timer.textContent = formatMs(currentState.timer.elapsedMs, true, extraMin);
    },1000);
  }

  /* ---------------- RENDER ---------------- */
  function renderState(state){
    if(!state) return;
    currentState = JSON.parse(JSON.stringify(state));
    lastTick = Date.now();

    el.homeName.textContent = state.teams.home.name;
    el.awayName.textContent = state.teams.away.name;
    el.homeScore.textContent = state.score.home;
    el.awayScore.textContent = state.score.away;
    el.period.textContent = periodLabel(state.period);

    const extraMin = state.extraTime ? state.extraTime/60000 : 0;
    el.timer.textContent = formatMs(state.timer.elapsedMs, true, extraMin);
    el.extraTime.textContent = extraMin;

    try{
      const homeLogo = localStorage.getItem(`${matchId}:homeLogo`);
      const awayLogo = localStorage.getItem(`${matchId}:awayLogo`);
      if(homeLogo) el.homeLogo.src = homeLogo;
      if(awayLogo) el.awayLogo.src = awayLogo;
    }catch{}

    if(state.lastGoal && state.lastGoal.id!==lastGoalId){
      lastGoalId = state.lastGoal.id;
      animateGoal(state.lastGoal.team);
      showGoalOverlay(state.lastGoal);
    }

    if(state.lastSub && state.lastSub.id!==lastSubId){
      lastSubId = state.lastSub.id;
      showSubOverlay(state.lastSub.team, state.lastSub.type);
    }

    if(state.period==="HALF_TIME") showHalftimeOverlay();

    startLocalClock();
  }

  /* ---------------- SYNC ---------------- */
  channel?.addEventListener("message", ev=>{
    const msg = ev.data;
    if(!msg?.payload?.state) return;
    renderState(msg.payload.state);
  });

  setInterval(()=>{
    const saved = localStorage.getItem(`${matchId}:state`);
    if(!saved) return;
    try{ renderState(JSON.parse(saved).state); } catch {}
  },1000);

  /* ---------------- INIT ---------------- */
  document.addEventListener("DOMContentLoaded", ()=>{
    const saved = localStorage.getItem(`${matchId}:state`);
    if(saved){
      try{ renderState(JSON.parse(saved).state); } catch {}
    }
  });

})();