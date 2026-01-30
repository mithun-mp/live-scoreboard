/* landing.js
   - Create new match and navigate to controller.html?matchId=...
   - Also present operator help text (see HTML area)
   - Uses simple UUID as matchId
*/
(function () {
  const genId = (() => {
    // small wrapper to reuse Utils.uuid if included; fallback to inline
    function smallUuid() {
      return 'ms-' + Math.random().toString(36).slice(2, 10);
    }
    return window.Utils && window.Utils.uuid ? window.Utils.uuid : smallUuid;
  })();

  function init() {
    const btn = document.querySelector('[data-action="create-match"]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const id = genId();
      // Navigate to the same index page with a matchId query param.
      // This keeps the repo GH Pages friendly and avoids requiring a separate controller.html.
      const base = window.location.pathname.replace(/\/[^/]*$/, '/') || './';
      const url = `${base}?matchId=${encodeURIComponent(id)}`;
      window.location.href = url;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();