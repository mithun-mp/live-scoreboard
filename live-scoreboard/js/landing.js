/* landing.js
   - Opens controller + display in TWO windows
   - Same matchId
   - User places display on extended screen manually
*/

(function () {

  function generateMatchId() {
    return 'ms-' + Math.random().toString(36).slice(2, 10);
  }

  function init() {
    const btn = document.querySelector('[data-action="create-match"]');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const matchId = generateMatchId();

      const controllerUrl = `setup.html?matchId=${matchId}`;
      const displayUrl = `match-start.html?matchId=${matchId}`;

      // 1️⃣ Open controller (or reuse current window)
      const controllerWin = window.open(
        controllerUrl,
        '_self'
      );

      // 2️⃣ Open display in new window
      const displayWin = window.open(
        displayUrl,
        'matchDisplay',
        'noopener,noreferrer'
      );

      if (!displayWin) {
        alert('Popup blocked. Allow popups for this site.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

})();