/* main.js
   - Global app context resolver
   - Detects mode: landing | controller | display
   - Exposes matchId safely
   - Keeps feature modules isolated
*/

(function () {
  const qs = new URLSearchParams(window.location.search || '');

  function detectMode() {
    const path = window.location.pathname;

    if (path.endsWith('display.html')) return 'display';
    if (qs.has('matchId')) return 'controller';
    return 'landing';
  }

  function genMatchId() {
    if (window.Utils && typeof window.Utils.uuid === 'function') {
      return window.Utils.uuid();
    }
    return 'ms-' + Math.random().toString(36).slice(2, 10);
  }

  const mode = detectMode();
  const matchId = qs.get('matchId');

  window.App = {
    mode,
    matchId,
    genMatchId
  };

  // Debug aid (safe to keep)
  console.info('[App]', { mode, matchId });
})();