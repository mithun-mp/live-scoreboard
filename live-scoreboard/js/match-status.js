/* Match Status UI – Full Feature Display Page */
(function () {
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId") || localStorage.getItem('lastMatchId') || "local";

  const Utils = window.Utils;
  const TimerFactory = window.Timer;

  // We can use Sync from window, but for Display we just need to listen.
  // We'll reimplement a simple listener or use Sync.create with 'display' role if it supports it.
  // Sync.create('display') works but we need to ensure we don't broadcast.
  const SyncLib = window.Sync;
  const sync = SyncLib ? SyncLib.create(matchId, "display") : null;

  const el = {
    homeName: document.getElementById("teamAName"),
    awayName: document.getElementById("teamBName"),
    homeScore: document.getElementById("scoreHome"),
    awayScore: document.getElementById("scoreAway"),
    timer: document.getElementById("timer"),
    extraTime: document.getElementById("extraTime"),
    homeLogo: document.getElementById("teamAImg"),
    awayLogo: document.getElementById("teamBImg"),
  };

  let fallbackDurationMs = 90 * 60 * 1000;

  function loadSetupFallback() {
    try {
      const setup = JSON.parse(localStorage.getItem(`${matchId}:setup`));
      if (setup) {
        const a = setup.teamA?.name || el.homeName.textContent;
        const b = setup.teamB?.name || el.awayName.textContent;
        el.homeName.textContent = a;
        el.awayName.textContent = b;
        if (setup.matchDuration) {
          fallbackDurationMs = (setup.matchDuration * 60 * 1000);
        }
        Utils.debug('status:setup-loaded', { matchId, teamA: a, teamB: b, durationMs: fallbackDurationMs });
      }
      const homeLogo = localStorage.getItem(`${matchId}:homeLogo`);
      const awayLogo = localStorage.getItem(`${matchId}:awayLogo`);
      if (homeLogo) el.homeLogo.src = homeLogo;
      if (awayLogo) el.awayLogo.src = awayLogo;
    } catch {}
  }

  // Timer Renderer
  const timerRenderer = TimerFactory.createRenderer({
    onRender: (elapsedMs) => {
      if (!currentState) return;
      const threshold = (currentState.derived && currentState.derived.thresholdMs) || (currentState.matchDurationMs || fallbackDurationMs);
      const main = Math.min(elapsedMs, threshold);
      const extra = Math.max(0, elapsedMs - threshold);
      el.timer.textContent = Utils.formatMs(main);
      el.extraTime.textContent = extra > 0 ? `+${Utils.formatMs(extra)}${currentState.derived?.addedTimeMin ? ` (${currentState.derived.addedTimeMin} min)` : ''}` : "";
    }
  });

  let currentState = null;
  let lastEventId = null;
  let metaParams = {
    home: params.get('home') || null,
    away: params.get('away') || null,
    duration: params.get('duration') ? parseInt(params.get('duration'), 10) : null,
    logoA: params.get('logoA') || null,
    logoB: params.get('logoB') || null
  };

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
    // Remove existing
    document.querySelectorAll('.goal-overlay').forEach(e => e.remove());

    const banner = document.createElement("div");
    banner.className = `goal-overlay ${goal.team === 'away' ? 'away' : 'home'}`;
    
    // Content
    const scorer = goal.scorer || "Unknown";
    const teamName = (function(){
      if (goal.team === 'home') {
        return (currentState && currentState.teams && currentState.teams.home && currentState.teams.home.name)
          || el.homeName.textContent
          || "Home";
      } else {
        return (currentState && currentState.teams && currentState.teams.away && currentState.teams.away.name)
          || el.awayName.textContent
          || "Away";
      }
    })();
    const min = goal.minute || Math.ceil(goal.timeMs / 60000);
    Utils.debug('status:event:goal', { team: teamName, scorer, minute: min, rawTeam: goal.team });
    
    banner.innerHTML = `
      <div class="goal-content">
        <div class="explosion"></div>
        <h1>GOAL!</h1>
        <div class="scorer">${scorer}</div>
        <div class="team">${teamName}</div>
        <div class="time">${min}'</div>
      </div>
    `;
    
    document.body.appendChild(banner);
    
    // Animation
    requestAnimationFrame(() => banner.classList.add("show"));
    
    // Hide after 4s (User asked for "highly celebrated", maybe longer? kept 4s for now, explosions will handle celebration)
    setTimeout(() => {
      banner.classList.remove("show");
      setTimeout(() => banner.remove(), 500);
    }, 5000);
  }

  function showSubOverlay(sub){
    // Remove existing of same team? Or allow multiple?
    // Let's remove only if same side to avoid overlap, or just stack them.
    // For simplicity, remove all for now or check side.
    // user wants "splitted on both side".
    
    const sideClass = sub.team === 'home' ? 'sub-home-side' : 'sub-away-side';
    
    // Remove existing on this side
    document.querySelectorAll(`.sub-overlay.${sideClass}`).forEach(e => e.remove());

    const overlay = document.createElement("div");
    overlay.className = `sub-overlay ${sideClass}`;
    
    const teamName = (function(){
      if (sub.team === 'home') {
        return (currentState && currentState.teams && currentState.teams.home && currentState.teams.home.name)
          || el.homeName.textContent
          || "Home";
      } else {
        return (currentState && currentState.teams && currentState.teams.away && currentState.teams.away.name)
          || el.awayName.textContent
          || "Away";
      }
    })();
    Utils.debug('status:event:sub', { team: teamName, in: sub.inName, out: sub.outName, rawTeam: sub.team });
    
    overlay.innerHTML = `
      <div class="sub-content">
        <div class="sub-header">SUBSTITUTION (${teamName})</div>
        <div class="sub-row out">
          <span class="icon">⬇</span> ${sub.outName}
        </div>
        <div class="sub-row in">
          <span class="icon">⬆</span> ${sub.inName}
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    
    // Show for 20 seconds as requested
    setTimeout(() => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 500);
    }, 20000);
  }

  function updateHalftimeOverlay(state) {
    let overlay = document.querySelector(".halftime-overlay");
    const isActive = state.period === "HALF_TIME";
    
    if (isActive) {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "halftime-overlay";
        document.body.appendChild(overlay);
      }
      overlay.innerHTML = `<div class="half-content"><h1>HALF TIME</h1><div class="half-sub">Second half begins soon</div></div>`;
      
    } else {
      if (overlay) overlay.remove();
    }
  }

  function updateFulltimeOverlay(state) {
    let overlay = document.querySelector(".fulltime-overlay");
    const isActive = state.period === "FULL_TIME";
    if (isActive) {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "fulltime-overlay";
        document.body.appendChild(overlay);
      }
      let resultText = "";
      if (state.score.home > state.score.away) resultText = `WINNERS: ${state.teams.home.name}`;
      else if (state.score.away > state.score.home) resultText = `WINNERS: ${state.teams.away.name}`;
      else resultText = "MATCH DRAW";
      const scoreText = `${state.teams.home.name} ${state.score.home} - ${state.score.away} ${state.teams.away.name}`;
      overlay.innerHTML = `<div class="full-content"><h1>FULL TIME</h1><div class="full-score">${scoreText}</div><div class="full-result">${resultText}</div></div>`;
    } else {
      if (overlay) overlay.remove();
    }
  }

  function animateGoal(team){
    const target = team==="home"? el.homeScore: el.awayScore;
    target.classList.add("goal-flash");
    setTimeout(()=> target.classList.remove("goal-flash"),900);
  }

  /* ---------------- RENDER ---------------- */
  function renderState(state){
    if(!state) return;
    currentState = state;

    el.homeName.textContent = metaParams.home || state.teams.home.name;
    el.awayName.textContent = metaParams.away || state.teams.away.name;
    el.homeScore.textContent = state.score.home;
    el.awayScore.textContent = state.score.away;
    // period label removed from UI per request
    Utils.debug('status:render', {
      period: state.period,
      score: `${state.score.home}-${state.score.away}`,
      teams: { home: state.teams.home.name, away: state.teams.away.name }
    });

    // Timer
    timerRenderer.updateState(state.timer);
    if (state.timer.running) {
        timerRenderer.start(state.timer);
    } else {
        timerRenderer.stop();
        const derived = state.derived ? state.derived.elapsedMs : state.timer.baseMs;
        el.timer.textContent = Utils.formatMs(derived);
    }

    // Logos
    try{
      const homeLogo = metaParams.logoA || localStorage.getItem(`${matchId}:homeLogo`);
      const awayLogo = metaParams.logoB || localStorage.getItem(`${matchId}:awayLogo`);
      if(homeLogo) el.homeLogo.src = homeLogo;
      if(awayLogo) el.awayLogo.src = awayLogo;
    }catch{}

    // Events
    if(state.lastEvent && state.lastEvent.id !== lastEventId){
      lastEventId = state.lastEvent.id;
      if (state.lastEvent.type === 'goal') {
        animateGoal(state.lastEvent.data.team);
        showGoalOverlay(state.lastEvent.data);
      } else if (state.lastEvent.type === 'sub') {
        showSubOverlay(state.lastEvent.data);
      }
    }

    // Overlays
    updateHalftimeOverlay(state);
    updateFulltimeOverlay(state);
  }

  // Last scorer and sub-history display removed per requirements.

  /* ---------------- SYNC ---------------- */
  if (sync) {
    sync.onMessage((msg) => {
        if (msg.payload && msg.payload.derived) {
             Utils.debug('status:sync:onMessage', { from: msg.role, id: msg.id, ts: msg.ts });
             renderState(msg.payload);
        } else {
             Utils.debug('status:sync:onMessage:ignored', { from: msg.role, id: msg.id, ts: msg.ts });
        }
    });
  }

  /* ---------------- INIT ---------------- */
  document.addEventListener("DOMContentLoaded", ()=>{
    const savedRaw = localStorage.getItem(`${matchId}:state`);
    if (savedRaw) {
      try {
        const saved = JSON.parse(savedRaw);
        if (saved && saved.state) {
          if (saved.meta) {
            metaParams = {
              home: params.get('home') || saved.meta.home || metaParams.home,
              away: params.get('away') || saved.meta.away || metaParams.away,
              duration: params.get('duration') ? parseInt(params.get('duration'),10) : (saved.meta.duration || metaParams.duration),
              logoA: params.get('logoA') || saved.meta.logoA || metaParams.logoA,
              logoB: params.get('logoB') || saved.meta.logoB || metaParams.logoB
            };
            if (metaParams.duration) fallbackDurationMs = metaParams.duration * 60 * 1000;
          }
          renderState(saved.state);
        }
      } catch {}
    }
    loadSetupFallback();
  });

})();
