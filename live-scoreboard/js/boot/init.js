/* init.js
   Bootstraps landing, setup, controller, or match-start mode.
*/
(function () {

  const MODE = {
    LANDING: 'landing',
    SETUP: 'setup',
    CONTROLLER: 'controller',
    MATCH_START: 'match-start',
  };

  function qs() {
    return new URLSearchParams(location.search || '');
  }

  function getMatchId() {
    return qs().get('matchId');
  }

  function loadScript(src) {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.body.appendChild(s);
  }

  function showArea(area) {
    const el = document.querySelector(`[data-area="${area}"]`);
    if (el) el.style.display = '';
  }

  function hideArea(area) {
    const el = document.querySelector(`[data-area="${area}"]`);
    if (el) el.style.display = 'none';
  }

  function hasSetup(matchId) {
    try {
      const setup = localStorage.getItem(`${matchId}:setup`);
      return setup && JSON.parse(setup);
    } catch (err) {
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {

    const matchId = getMatchId();
    const body = document.body;

    if (!matchId) {
      // LANDING PAGE
      body.dataset.mode = MODE.LANDING;
      showArea(MODE.LANDING);
      hideArea(MODE.SETUP);
      hideArea(MODE.CONTROLLER);
      hideArea(MODE.MATCH_START);

      loadScript('js/boot/landing.js');
      loadScript('js/ui/landing-ui.js');
      return;
    }

    const setupData = hasSetup(matchId);

    if (!setupData) {
      // SETUP PAGE
      body.dataset.mode = MODE.SETUP;
      showArea(MODE.SETUP);
      hideArea(MODE.LANDING);
      hideArea(MODE.CONTROLLER);
      hideArea(MODE.MATCH_START);

      loadScript('js/ui/setup-ui.js');
      return;
    }

    // MATCH START PAGE (external display)
    if (body.classList.contains('match-start')) {
      body.dataset.mode = MODE.MATCH_START;
      hideArea(MODE.LANDING);
      hideArea(MODE.SETUP);
      hideArea(MODE.CONTROLLER);
      showArea(MODE.MATCH_START);

      loadScript('js/ui/matchs-start-ui.js');
      return;
    }

    // CONTROLLER PAGE
    body.dataset.mode = MODE.CONTROLLER;
    hideArea(MODE.LANDING);
    hideArea(MODE.SETUP);
    hideArea(MODE.MATCH_START);
    showArea(MODE.CONTROLLER);

    // Load core + UI scripts
    loadScript('js/core/utils.js');       // Utils must be first
    loadScript('js/core/matchState.js');
    loadScript('js/core/sync.js');
    loadScript('js/core/timer.js');
    loadScript('js/ui/controller-ui.js');
  });

})();