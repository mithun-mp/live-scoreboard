/* setup-ui.js
   - Handles pre-match setup (teams, logos, match duration)
   - Saves data for controller/display
   - Redirects to controller after setup
*/
(function () {
  const qs = () => new URLSearchParams(location.search || '');
  const getMatchId = () => qs().get('matchId') || null;

  function init() {
    const setupArea = document.querySelector('[data-area="setup"]');
    if (!setupArea) return;

    const homeInput = document.getElementById('homeTeamName');
    const awayInput = document.getElementById('awayTeamName');
    const homeLogoInput = document.getElementById('homeLogo');
    const awayLogoInput = document.getElementById('awayLogo');
    const durationInput = document.getElementById('matchDuration');
    const startBtn = document.getElementById('startMatchBtn');

    const matchId = getMatchId();
    if (!matchId) {
      console.error('No matchId found. Cannot start setup.');
      return;
    }

    // Show setup area
    setupArea.style.display = '';

    // Preview logos
    function previewLogo(input, previewKey) {
      input.addEventListener('change', (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            localStorage.setItem(`${matchId}:${previewKey}`, e.target.result);
          } catch (err) {
            console.error('Error saving logo to localStorage', err);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    previewLogo(homeLogoInput, 'homeLogo');
    previewLogo(awayLogoInput, 'awayLogo');

    startBtn.addEventListener('click', () => {
      const homeName = homeInput.value.trim() || 'Home';
      const awayName = awayInput.value.trim() || 'Away';
      let duration = parseInt(durationInput.value, 10);
      if (isNaN(duration) || duration < 10) duration = 10;
      if (duration > 90) duration = 90;

      // Save basic settings for controller/display
      const setupData = {
        home: { name: homeName, id: 'home' },
        away: { name: awayName, id: 'away' },
        matchDuration: duration * 60 * 1000, // convert minutes to ms
        createdAt: Date.now()
      };

      try {
        localStorage.setItem(`${matchId}:setup`, JSON.stringify(setupData));
      } catch (err) {
        console.error('Failed to save match setup', err);
      }

      // Redirect to controller view
      const base = window.location.pathname.replace(/\/[^/]*$/, '/') || './';
      const url = `${base}?matchId=${encodeURIComponent(matchId)}`;
      window.location.href = url;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();