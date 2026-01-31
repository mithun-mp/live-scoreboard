(function() {
  const qs = new URLSearchParams(location.search);
  const matchId = qs.get('matchId') || 'match-' + Date.now();

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

  // Helper: preview logo
  function previewLogo(input, previewEl, key) {
    input.addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        previewEl.src = e.target.result;
        localStorage.setItem(`${matchId}:${key}`, e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  previewLogo(teamALogoInput, teamALogoPreview, 'teamALogo');
  previewLogo(teamBLogoInput, teamBLogoPreview, 'teamBLogo');

  // Load saved logos if exist
  function loadLogo(key, previewEl) {
    try {
      const dataUrl = localStorage.getItem(`${matchId}:${key}`);
      if (dataUrl && previewEl) previewEl.src = dataUrl;
    } catch (e) {}
  }

  loadLogo('teamALogo', teamALogoPreview);
  loadLogo('teamBLogo', teamBLogoPreview);

  // Save setup without refresh
  saveBtn.addEventListener('click', () => {
    const setupData = {
      teamA: { name: teamANameInput.value.trim() || 'Team A' },
      teamB: { name: teamBNameInput.value.trim() || 'Team B' },
      matchDuration: parseInt(matchDurationInput.value, 10) || 90
    };
    try {
      localStorage.setItem(`${matchId}:setup`, JSON.stringify(setupData));
      alert('Setup saved successfully!');
    } catch (err) {
      console.error('Failed to save setup', err);
    }
  });

  // Start countdown in new window
  startBtn.addEventListener('click', () => {
    const setupDataRaw = localStorage.getItem(`${matchId}:setup`);
    if (!setupDataRaw) {
      alert('Please save setup first!');
      return;
    }
    const url = `match-start.html?matchId=${matchId}`;
    const matchWindow = window.open(url, '_blank', 'width=800,height=600');
    
    // Optional: start countdown in same window redirect to controller after countdown
    setTimeout(() => {
      window.location.href = `controller.html?matchId=${matchId}`;
    }, 500); // small delay to ensure localStorage is set
  });
})();