(function () {
  const qs = new URLSearchParams(location.search);
  const matchId = qs.get('matchId') || 'match-' + Date.now();

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
      };
      reader.readAsDataURL(file);
    });
  }

  previewLogo(teamALogoInput, teamALogoPreview, 'teamALogo');
  previewLogo(teamBLogoInput, teamBLogoPreview, 'teamBLogo');

  function loadLogo(key, previewEl) {
    const dataUrl = localStorage.getItem(`${matchId}:${key}`);
    if (dataUrl) previewEl.src = dataUrl;
  }

  loadLogo('teamALogo', teamALogoPreview);
  loadLogo('teamBLogo', teamBLogoPreview);

  /* ---------- Save Setup ---------- */
  saveBtn.addEventListener('click', () => {
    const setupData = {
      teamA: { name: teamANameInput.value.trim() || 'Team A' },
      teamB: { name: teamBNameInput.value.trim() || 'Team B' },
      matchDuration: parseInt(matchDurationInput.value, 10) || 90,
    };

    localStorage.setItem(`${matchId}:setup`, JSON.stringify(setupData));

    // Notify match-start window
    channel?.postMessage({ type: 'SETUP_UPDATED' });

    alert('Setup saved successfully!');
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
    } else {
      matchWindow.focus();
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

    // Redirect this setup page to controller
    setTimeout(() => {
      location.href = `controller.html?matchId=${matchId}`;
    }, 300);
  });
})();