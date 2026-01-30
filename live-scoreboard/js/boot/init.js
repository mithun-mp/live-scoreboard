/* init.js
   - Lightweight startup logic for index.html (landing + controller) and display.html
   - Detects presence of `matchId` query param. If present, keeps controller UI visible.
   - If no matchId, shows landing help UI.
   - Keeps logic minimal so other UI modules can remain self-bootstrapping.
*/
(function () {
  function qs() {
    return new URLSearchParams(location.search || '');
  }

  function getMatchId() {
    const p = qs();
    return p.get('matchId') || null;
  }

  function hideSelector(sel) {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  }

  function showSelector(sel) {
    const el = document.querySelector(sel);
    if (el) el.style.display = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const matchId = getMatchId();
    // If on index.html and matchId present -> controller mode
    if (matchId) {
      // Hide landing area if present
      hideSelector('[data-area="landing"]');
      showSelector('[data-area="controller"]');
      // Mark body for CSS hooks
      document.body.setAttribute('data-mode', 'controller');
    } else {
      // Show landing
      showSelector('[data-area="landing"]');
      hideSelector('[data-area="controller"]');
      document.body.setAttribute('data-mode', 'landing');
    }

    // For display.html we expect it to be purely display-only; no landing logic required.
  });
})();
