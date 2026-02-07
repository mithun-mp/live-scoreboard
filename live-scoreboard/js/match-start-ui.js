(function () {
  const qs = new URLSearchParams(location.search);
  const matchId = qs.get("matchId");
  if (!matchId) return;

  const channel =
    "BroadcastChannel" in window
      ? new BroadcastChannel(`match-${matchId}`)
      : null;

  const body = document.body;
  const matchText = document.getElementById("matchText");
  const teamAName = document.getElementById("teamAName");
  const teamBName = document.getElementById("teamBName");
  const teamAImg = document.getElementById("teamAImg");
  const teamBImg = document.getElementById("teamBImg");
  const countdownEl = document.getElementById("countdown");

  /* ===== STATE CONTROL ===== */
  function setStage(stage) {
    body.className = `state-${stage}`;
    localStorage.setItem(`${matchId}:stage`, stage);
  }

  function getStage() {
    return localStorage.getItem(`${matchId}:stage`) || "idle";
  }

  /* ===== LOAD DATA ===== */
  function loadSetup() {
    const raw = localStorage.getItem(`${matchId}:setup`);
    if (!raw) return false;

    const s = JSON.parse(raw);
    teamAName.textContent = s.teamA?.name || "";
    teamBName.textContent = s.teamB?.name || "";
    try { Utils.debug('match-start:setup-loaded', { matchId, teamA: s.teamA?.name, teamB: s.teamB?.name }); } catch {}
    return true;
  }

  function loadLogos() {
    const a = localStorage.getItem(`${matchId}:homeLogo`);
    const b = localStorage.getItem(`${matchId}:awayLogo`);
    if (a) teamAImg.src = a;
    if (b) teamBImg.src = b;
    try { Utils.debug('match-start:logos-loaded', { hasA: Boolean(a), hasB: Boolean(b) }); } catch {}
  }

  /* ===== COUNTDOWN ===== */
  function animate() {
    countdownEl.classList.remove("tick");
    void countdownEl.offsetWidth;
    countdownEl.classList.add("tick");
  }

  function startCountdown() {
    setStage("countdown");
    matchText.textContent = "Match starts in";

    let t = 10;
    countdownEl.textContent = t;
    animate();
    try { Utils.debug('match-start:countdown-start', { seconds: t }); } catch {}

    const timer = setInterval(() => {
      t--;
      countdownEl.textContent = t > 0 ? t : "LETS FOOTBALL!";
      animate();

      if (t <= 0) {
        clearInterval(timer);
        channel?.postMessage({ type: "MATCH_STARTED" });
        setTimeout(() => {
          location.href = `match-status.html?matchId=${matchId}`;
        }, 1000);
      }
    }, 1000);
  }

  /* ===== EVENTS ===== */
  channel?.addEventListener("message", e => {
    if (!e.data) return;

    if (e.data.type === "SETUP_UPDATED") {
      loadSetup();
      loadLogos();
      matchText.textContent = "Teams are ready";
      setStage("ready");
      try { Utils.debug('match-start:event:setup-updated'); } catch {}
    }

    if (e.data.type === "START_COUNTDOWN") {
      startCountdown();
      try { Utils.debug('match-start:event:start-countdown'); } catch {}
    }
  });

  /* ===== INIT ===== */
  loadSetup();
  loadLogos();
  setStage(getStage());
})();
