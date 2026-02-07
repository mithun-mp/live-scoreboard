/* Controller UI – Full Feature Match Lifecycle */
(function () {
  const params = new URLSearchParams(location.search);
  const matchId = params.get("matchId") || "local";
  const urlMeta = {
    home: params.get("home") || null,
    away: params.get("away") || null,
    duration: params.get("duration") ? parseInt(params.get("duration"), 10) : null,
    logoA: params.get("logoA") || null,
    logoB: params.get("logoB") || null,
  };

  const Utils = window.Utils;
  const SyncLib = window.Sync;
  const MatchStateFactory = window.MatchState;
  const TimerFactory = window.Timer;

  if (!Utils || !SyncLib || !MatchStateFactory || !TimerFactory) {
    console.error("Controller dependencies missing");
    return;
  }

  const sync = SyncLib.create(matchId, "controller");

  function currentMeta(state) {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem(`${matchId}:state`)); } catch { return null; }
    })();
    const base = saved && saved.meta ? saved.meta : {};
    const logos = {
      logoA: urlMeta.logoA || base.logoA || localStorage.getItem(`${matchId}:homeLogo`) || null,
      logoB: urlMeta.logoB || base.logoB || localStorage.getItem(`${matchId}:awayLogo`) || null,
    };
    return {
      home: urlMeta.home || base.home || state.teams.home.name,
      away: urlMeta.away || base.away || state.teams.away.name,
      duration: urlMeta.duration || base.duration || Math.floor((state.matchDurationMs || (90*60*1000)) / 60000),
      ...logos
    };
  }

  function persistState(payload) {
    const envelope = {
      meta: currentMeta(payload),
      state: payload
    };
    try { localStorage.setItem(`${matchId}:state`, JSON.stringify(envelope)); } catch {}
  }

  const originalBroadcast = sync.broadcast;
  sync.broadcast = (data) => {
    Utils.debug('controller:broadcast', { period: data.period, event: data.lastEvent?.type });
    persistState(data);
    originalBroadcast.call(sync, data);
    renderState(data);
  };

  const match = MatchStateFactory.create(matchId, null, sync);
  
  let latestState = null;

  // Timer Renderer for Controller (visual only)
  const timerRenderer = TimerFactory.createRenderer({
    onRender: (elapsedMs) => {
      if (!latestState) return;

      const threshold = latestState.derived ? latestState.derived.thresholdMs : latestState.matchDurationMs;
      const mainTime = Math.min(elapsedMs, threshold);
      const extraTime = Math.max(0, elapsedMs - threshold);
      
      const elTimer = document.querySelector('[data-bind="timer"]');
      const elExtra = document.querySelector('[data-bind="extra-time"]');

      if (elTimer) elTimer.textContent = Utils.formatMs(mainTime);
      
      if (elExtra) {
          elExtra.textContent = extraTime > 0
            ? `+${Utils.formatMs(extraTime)}${(latestState.derived && latestState.derived.addedTimeMin) ? ` (${latestState.derived.addedTimeMin} min)` : ''}`
            : "";
      }
    }
  });

  let lastEventId = null;

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
      const setup = JSON.parse(localStorage.getItem(`${matchId}:setup`)) || {};

      const totalMs = ((urlMeta.duration || setup.matchDuration || 90)) * 60 * 1000;

      match.setStatePatch({
        teams: {
          home: { ...match.getState().teams.home, ...(setup.teamA || {}), ...(urlMeta.home ? { name: urlMeta.home } : {}) },
          away: { ...match.getState().teams.away, ...(setup.teamB || {}), ...(urlMeta.away ? { name: urlMeta.away } : {}) },
        },
        matchDurationMs: totalMs,
      });
      Utils.debug('controller:setup-loaded', {
        matchId,
        teamA: urlMeta.home || (setup.teamA && setup.teamA.name),
        teamB: urlMeta.away || (setup.teamB && setup.teamB.name),
        durationMs: totalMs
      });
    } catch (e) {
      console.warn("Setup load failed", e);
    }
  }

  /* ---------------- RENDER ---------------- */
  function renderState(state) {
    if (!state) return;

    const bind = (k, val) => {
        const els = document.querySelectorAll(`[data-bind="${k}"]`);
        els.forEach(el => el.textContent = val);
    };
    
    bind("team-home-name", state.teams.home.name);
    bind("team-away-name", state.teams.away.name);
    bind("score-home", state.score.home);
    bind("score-away", state.score.away);
    bind("period", getPeriodLabel(state.period));
    
    // Update Timer State in Renderer
    timerRenderer.updateState(state.timer);
    if (state.timer.running) {
        timerRenderer.start(state.timer);
    } else {
        timerRenderer.stop();
        // Force one render for static time
        const derivedElapsed = state.derived ? state.derived.elapsedMs : state.timer.baseMs;
        const els = document.querySelectorAll('[data-bind="timer"]');
        els.forEach(el => el.textContent = Utils.formatMs(derivedElapsed));
    }
    
    bind("display-count").textContent = "Active"; // Placeholder, sync doesn't track count yet

    const dbg = document.getElementById("matchStateDebug");
    if (dbg) dbg.textContent = JSON.stringify(state, null, 2);

    // Event Toasts (Goals/Subs)
    if (state.lastEvent && state.lastEvent.id !== lastEventId) {
      lastEventId = state.lastEvent.id;
      if (state.lastEvent.type === 'goal') {
         showToast(`Goal: ${state.lastEvent.data.scorer} (${state.lastEvent.data.team})`);
      } else if (state.lastEvent.type === 'sub') {
         showToast(`Sub: ${state.lastEvent.data.inName} IN, ${state.lastEvent.data.outName} OUT`);
      }
    }
    Utils.debug('controller:render', {
      period: state.period,
      score: `${state.score.home}-${state.score.away}`,
      teams: { home: state.teams.home.name, away: state.teams.away.name }
    });
  }
  
  function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.style.position = "fixed";
    t.style.bottom = "20px";
    t.style.right = "20px";
    t.style.background = "#333";
    t.style.color = "#fff";
    t.style.padding = "10px 20px";
    t.style.borderRadius = "4px";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /* ---------------- ACTIONS ---------------- */
  function addGoal(team) {
    const teamName = match.getState().teams[team].name;
    const scorer = prompt(`GOAL for ${teamName}!\n\nEnter Scorer Name:`);
    // If user cancels, we typically don't record. 
    // But maybe they just want to record goal without name? 
    // Let's assume cancel = cancel action.
    if (scorer === null) return; 
    
    Utils.debug('controller:action:goal', { team, teamName, scorer: scorer || 'Unknown' });
    match.recordGoal(team, scorer || "Unknown");
  }

  function substitute(team) {
    const teamName = match.getState().teams[team].name;
    const inName = prompt(`Substitution for ${teamName}\n\nPlayer IN:`);
    if (inName === null) return;
    
    const outName = prompt(`Player OUT:`);
    if (outName === null) return; // Allow partial? No, need both usually.

    Utils.debug('controller:action:sub', { team, teamName, inName: inName || 'Unknown', outName: outName || 'Unknown' });
    match.recordSub(team, 'SUB', inName || "Unknown", outName || "Unknown");
  }

  function editName(team) {
      const current = match.getState().teams[team].name;
      const newName = prompt(`Edit Name for ${team}:`, current);
      if (newName && newName !== current) {
          Utils.debug('controller:action:editName', { team, from: current, to: newName });
          match.setStatePatch({
              teams: {
                  [team]: { name: newName }
              }
          });
      }
  }
  
  function editScore(team) {
      const current = match.getState().score[team];
      const newScore = parseInt(prompt(`Edit Score for ${team}:`, current), 10);
      if (!isNaN(newScore) && newScore !== current) {
           Utils.debug('controller:action:editScore', { team, from: current, to: newScore });
           match.setStatePatch({
              score: {
                  [team]: newScore
              }
          });
      }
  }

  /* ---------------- DOM BIND ---------------- */
  function bindDom() {
    const q = (a) => document.querySelector(`[data-action="${a}"]`);

    // Timer
    q("start-timer")?.addEventListener("click", () => { Utils.debug('controller:action:startTimer'); match.startTimer(); });
    q("pause-timer")?.addEventListener("click", () => { Utils.debug('controller:action:pauseTimer'); match.pauseTimer(); });
    
    // Goals
    q("goal-home")?.addEventListener("click", () => addGoal("home"));
    q("goal-away")?.addEventListener("click", () => addGoal("away"));
    q("undo")?.addEventListener("click", match.undoLastGoal);

    // Periods
    q("start-first-half")?.addEventListener("click", () => { Utils.debug('controller:action:startFirstHalf'); match.startFirstHalf(); });
    q("half-time")?.addEventListener("click", () => { Utils.debug('controller:action:halfTime'); match.halftime(); });
    // matchState has setPeriod or auto transition.
    // Let's check matchState methods. 
    // It has setPeriod. We can use that.
    // Actually, let's just use setPeriod for manual overrides.
    
    q("half-time")?.addEventListener("click", () => match.setPeriod("HALF_TIME"));
    q("start-second-half")?.addEventListener("click", match.startSecondHalf);
    q("end-match")?.addEventListener("click", () => match.setPeriod("FULL_TIME"));
    q("undo-period")?.addEventListener("click", match.undoLastPeriod);
    
    // Extra Time
    q("add-extra-time")?.addEventListener("click", () => {
      const min = parseInt(prompt("Extra Time (minutes):"), 10);
      if (!isNaN(min)) {
        match.setExtraTime(min);
      }
    });

    // Subs
    q("sub-home")?.addEventListener("click", () => substitute("home"));
    q("sub-away")?.addEventListener("click", () => substitute("away"));
    q("undo-sub")?.addEventListener("click", match.undoLastSub);

    // Direct Edits (Scoreboard Panel)
    const bind = (k) => document.querySelector(`[data-bind="${k}"]`);
    
    bind("score-home")?.addEventListener("click", () => editScore("home"));
    bind("score-away")?.addEventListener("click", () => editScore("away"));
    
    bind("team-home-name")?.addEventListener("click", () => editName("home"));
    bind("team-away-name")?.addEventListener("click", () => editName("away"));

    // Debug Toggle
    document.getElementById("toggleDebug")?.addEventListener("click", () => {
        document.getElementById("debugPanel")?.classList.toggle("collapsed");
    });
    
    // View Logo Buttons (Controller)
    function setupViewLogo(action, key) {
        const btn = document.querySelector(`[data-action="${action}"]`);
        if(btn) {
            btn.addEventListener("click", () => {
                const dataUrl = localStorage.getItem(`${matchId}:${key}`);
                if (dataUrl) {
                    const w = window.open("", "_blank");
                    w.document.write(`
                        <html>
                          <head><title>Logo View</title></head>
                          <body style="background: #111; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                            <img src="${dataUrl}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
                          </body>
                        </html>
                    `);
                } else {
                    alert("No logo found.");
                }
            });
        }
    }
    setupViewLogo("view-logo-home", "homeLogo");
    setupViewLogo("view-logo-away", "awayLogo");
  }

  /* ---------------- INIT ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${matchId}:state`));
      if (saved && saved.state) {
        match.setStatePatch(saved.state);
        renderState(saved.state);
      }
    } catch {}
    loadSetup();
    bindDom();
    
    // Initial Render
    renderState(match.getState());
    
    // Listen for own broadcasts (to update UI if logic changes state) 
    // Actually matchState calls sync.broadcast, but we are the controller.
    // matchState internal object is source of truth.
    // We can subscribe to matchState changes if we implemented a listener pattern,
    // but here we can just rely on the tick/update cycle or hook into broadcast.
    
    // However, matchState doesn't emit events locally easily unless we hack sync.
    // Let's poll for now or hook sync.
    // Better: wrap matchState.create to allow a callback?
    // Or just rely on the fact that we call methods and they update state?
    // The issue is auto-transitions (tick).
    // We need to know when state changes due to tick.
    
    // Let's hook into the sync broadcast to update our own UI.
    // already overridden above to persist + render
    
    // Start the loop if needed (matchState starts it on startTimer)
    
    // AUTO-START FIRST HALF AFTER 10s
    // Start concurrently across displays by letting controller trigger the authoritative state.
    setTimeout(() => {
      const currentState = match.getState();
      if (currentState.period === "PRE_MATCH" && !currentState.timer.running) {
        match.startFirstHalf();
      }
    }, 10000);
  });

  /* ---------- Info Modal ---------- */
  const infoBtn = document.getElementById("infoBtn");
  const modal = document.getElementById("infoModal");
  const closeBtn = document.getElementById("closeModal");

  if(infoBtn && modal && closeBtn) {
      infoBtn.addEventListener("click", () => modal.classList.add("show"));
      closeBtn.addEventListener("click", () => modal.classList.remove("show"));
      modal.addEventListener("click", (e) => {
          if(e.target === modal) modal.classList.remove("show");
      });
      // ESC to close
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") modal.classList.remove("show");
      });
  }

})();
