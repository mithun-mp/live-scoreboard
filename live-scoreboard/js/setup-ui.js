(function () {
  const qs = new URLSearchParams(location.search);
  const matchId = qs.get('matchId') || 'match-' + Date.now();
  try { localStorage.setItem('lastMatchId', matchId); } catch {}

  const channel =
    'BroadcastChannel' in window
      ? new BroadcastChannel(`match-${matchId}`)
      : null;

  // DOM Elements
  const teamANameInput = document.getElementById('teamAName');
  const teamBNameInput = document.getElementById('teamBName');
  const teamALogoInput = document.getElementById('teamALogo');
  const teamBLogoInput = document.getElementById('teamBLogo');
  const teamALogoPreview = document.getElementById('teamALogoPreview');
  const teamBLogoPreview = document.getElementById('teamBLogoPreview');
  const matchDurationInput = document.getElementById('matchDuration');
  const saveBtn = document.getElementById('saveSetupBtn');
  const startBtn = document.getElementById('startCountdownBtn');
  const openScreenBtn = document.getElementById('openScreenBtn');

  // Track the match-start window
  let matchWindow = null;

  /* ---------- Logo Preview ---------- */
  function previewLogo(input, previewEl, key) {
    input.addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        previewEl.src = e.target.result;
        localStorage.setItem(`${matchId}:${key}`, e.target.result);

        channel?.postMessage({ type: 'SETUP_UPDATED' });
        try { Utils.debug('setup:logo-set', { key, size: e.target.result && e.target.result.length }); } catch {}
      };
      reader.readAsDataURL(file);
    });
  }

  previewLogo(teamALogoInput, teamALogoPreview, 'homeLogo');
  previewLogo(teamBLogoInput, teamBLogoPreview, 'awayLogo');

  function loadLogo(key, previewEl) {
    const dataUrl = localStorage.getItem(`${matchId}:${key}`);
    if (dataUrl) previewEl.src = dataUrl;
  }

  loadLogo('homeLogo', teamALogoPreview);
  loadLogo('awayLogo', teamBLogoPreview);

  /* ---------- Save Setup ---------- */
  saveBtn.addEventListener('click', () => {
    const setupData = {
      teamA: { name: teamANameInput.value.trim() || 'Team A' },
      teamB: { name: teamBNameInput.value.trim() || 'Team B' },
      matchDuration: parseInt(matchDurationInput.value, 10) || 90,
    };

    localStorage.setItem(`${matchId}:setup`, JSON.stringify(setupData));
    try { localStorage.setItem('lastMatchId', matchId); } catch {}

    // Notify match-start window
    channel?.postMessage({ type: 'SETUP_UPDATED' });

    alert('Setup saved successfully!');
    try { Utils.debug('setup:saved', { matchId, teamA: setupData.teamA.name, teamB: setupData.teamB.name, duration: setupData.matchDuration }); } catch {}
  });

  /* ---------- Manual Screen Open ---------- */
  openScreenBtn?.addEventListener('click', () => {
    if (!localStorage.getItem(`${matchId}:setup`)) {
      alert('Please save setup first!');
      return;
    }

    // Open window only if closed or not yet opened
    if (!matchWindow || matchWindow.closed) {
      matchWindow = window.open(
        `match-start.html?matchId=${matchId}`,
        '_blank',
        'width=1280,height=720'
      );
      try { Utils.debug('setup:open-display', { matchId }); } catch {}
    } else {
      matchWindow.focus();
      try { Utils.debug('setup:focus-display', { matchId }); } catch {}
    }
  });

  /* ---------- Start Countdown ---------- */
  startBtn.addEventListener('click', () => {
    if (!localStorage.getItem(`${matchId}:setup`)) {
      alert('Please save setup first!');
      return;
    }

    // Only bring the already opened window to front
    if (!matchWindow || matchWindow.closed) {
      matchWindow = window.open(
        `match-start.html?matchId=${matchId}`,
        '_blank',
        'width=1280,height=720'
      );
    } else {
      // Focus existing window, no new window
      matchWindow.focus();
    }

    // Broadcast countdown start (match-start window will start countdown)
    channel?.postMessage({ type: 'START_COUNTDOWN' });
    try { Utils.debug('setup:start-countdown', { matchId }); } catch {}

    // Redirect this setup page to controller
    setTimeout(() => {
      try {
        const setupRaw = localStorage.getItem(`${matchId}:setup`);
        const setup = setupRaw ? JSON.parse(setupRaw) : null;
        const home = encodeURIComponent(setup?.teamA?.name || 'Team A');
        const away = encodeURIComponent(setup?.teamB?.name || 'Team B');
        const duration = encodeURIComponent(setup?.matchDuration || 90);
        const logoA = encodeURIComponent(localStorage.getItem(`${matchId}:homeLogo`) || '');
        const logoB = encodeURIComponent(localStorage.getItem(`${matchId}:awayLogo`) || '');
        location.href = `controller.html?matchId=${matchId}&home=${home}&away=${away}&duration=${duration}&logoA=${logoA}&logoB=${logoB}`;
      } catch {
        location.href = `controller.html?matchId=${matchId}`;
      }
    }, 300);
  });

  /* ---------- View Logo Button ---------- */
  function setupViewLogo(btnId, key) {
      const btn = document.getElementById(btnId);
      if(!btn) return;
      
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
              alert("No logo uploaded yet.");
          }
      });
  }

  setupViewLogo("viewLogoA", "homeLogo");
  setupViewLogo("viewLogoB", "awayLogo");

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
  }
})();
