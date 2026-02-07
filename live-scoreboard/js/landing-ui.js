/* landing-ui.js – Premium Landing UI Interactivity */

(function () {
  // ----------------- Digital Clock -----------------
  const digitalClock = document.getElementById('digitalClock');

  function updateClock() {
    if (!digitalClock) return;
    const now = new Date();
    digitalClock.textContent = now.toLocaleTimeString([], { hour12: false });
  }

  setInterval(updateClock, 1000);
  updateClock();

  // ----------------- Smooth Page Transitions -----------------
  const landingArea = document.querySelector('[data-area="landing"]');
  const setupArea = document.querySelector('[data-area="setup"]');
  const controllerArea = document.querySelector('[data-area="controller"]');
  const displayArea = document.querySelector('[data-area="display"]');

  function showArea(area) {
    [landingArea, setupArea, controllerArea, displayArea].forEach(a => {
      if (!a) return;
      a.style.display = 'none';
      a.style.opacity = 0;
      a.style.transition = 'opacity 0.5s ease';
    });

    if (area) {
      area.style.display = '';
      setTimeout(() => { area.style.opacity = 1; }, 50);
    }
  }

  showArea(landingArea);

  // ----------------- Setup New Match Button -----------------
  const createMatchBtn = document.querySelector('[data-action="create-match"]');
  if (createMatchBtn) {
    createMatchBtn.addEventListener('click', () => {
      // Generate a unique matchId
      const matchId = 'match-' + Date.now();
      window.App = window.App || {};
      App.matchId = matchId;
      App.mode = 'controller'; // next mode after landing

      // Show setup screen with animation
      if (setupArea) {
        document.getElementById('setupMatchId').textContent = matchId;
        showArea(setupArea);
      }

      // Optional: highlight the setup button
      const goControllerBtn = document.getElementById('goController');
      if (goControllerBtn) {
        goControllerBtn.classList.add('glow-animation');
        setTimeout(() => goControllerBtn.classList.remove('glow-animation'), 1500);
      }
    });
  }

  // ----------------- Go Controller Button -----------------
  const goControllerBtn = document.getElementById('goController');
  if (goControllerBtn) {
    goControllerBtn.addEventListener('click', () => {
      showArea(controllerArea);
    });
  }

  // ----------------- Open Display Button -----------------
  const openDisplayBtn = controllerArea?.querySelector('button');
  if (openDisplayBtn) {
    openDisplayBtn.addEventListener('click', () => {
      if (!App || !App.matchId) return;
      const id = App.matchId;
      let home = 'Team A';
      let away = 'Team B';
      let duration = 90;
      let logoA = '';
      let logoB = '';
      try {
        const setupRaw = localStorage.getItem(`${id}:setup`);
        const setup = setupRaw ? JSON.parse(setupRaw) : {};
        home = setup?.teamA?.name || home;
        away = setup?.teamB?.name || away;
        duration = setup?.matchDuration || duration;
        logoA = localStorage.getItem(`${id}:homeLogo`) || '';
        logoB = localStorage.getItem(`${id}:awayLogo`) || '';
      } catch {}
      const url = `match-status.html?matchId=${encodeURIComponent(id)}&home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}&duration=${encodeURIComponent(duration)}&logoA=${encodeURIComponent(logoA)}&logoB=${encodeURIComponent(logoB)}`;
      window.open(url, '_blank', 'width=1280,height=720');
    });
  }

  // ----------------- Hover Glow Effect for Buttons -----------------
  const allBtns = document.querySelectorAll('button');
  allBtns.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.boxShadow = '0 0 20px #FF3D00, 0 0 40px #E10600';
      btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.boxShadow = '';
      btn.style.transform = '';
    });
  });

  // ----------------- Optional: Soccer Ball Bounce Animation Trigger -----------------
  const soccerBall = document.querySelector('.soccer-animation');
  if (soccerBall) {
    setInterval(() => {
      soccerBall.style.transform = 'translateY(-20px)';
      setTimeout(() => soccerBall.style.transform = 'translateY(0)', 400);
    }, 3000);
  }

  console.info('[landing-ui] premium landing initialized');
})();
