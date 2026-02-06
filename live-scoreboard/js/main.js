/* main.js
   ------------------------------------------------
   Global application context
   - Detects active page mode
   - Exposes matchId safely
   - Provides matchId generator
   - No UI logic
*/

(function () {

  const qs = new URLSearchParams(window.location.search || '');
  const path = window.location.pathname.toLowerCase();

  /* -------- Mode detection -------- */

  function detectMode() {
    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
      return 'landing';
    }

    if (path.endsWith('setup.html')) {
      return 'setup';
    }

    if (path.endsWith('match-start.html')) {
      return 'match-start';
    }

    if (path.endsWith('controller.html')) {
      return 'controller';
    }

    if (path.endsWith('display.html')) {
      return 'display';
    }

    return 'unknown';
  }

  /* -------- Match ID -------- */

  function genMatchId() {
    if (window.Utils && typeof window.Utils.uuid === 'function') {
      return window.Utils.uuid();
    }
    return 'ms-' + Math.random().toString(36).slice(2, 10);
  }

  const mode = detectMode();
  const matchId = qs.get('matchId');

  /* -------- Global App Context -------- */

  window.App = {
    mode,
    matchId,
    hasMatch: Boolean(matchId),
    genMatchId
  };

  /* -------- Debug (safe) -------- */

  console.info('[App]', {
    mode,
    matchId,
    path
  });

})();