/* landing.js
   - Creates a new matchId
   - Redirects to controller mode using ?matchId=
   - GitHub Pages & local-server safe
*/

(function () {
  function fallbackUuid() {
    return 'ms-' + Math.random().toString(36).slice(2, 10);
  }

  const genId =
    window.Utils && typeof window.Utils.uuid === "function"
      ? window.Utils.uuid
      : fallbackUuid;

  function init() {
    const btn = document.querySelector('[data-action="create-match"]');
    if (!btn) return;

    btn.addEventListener("click", () => {
      const matchId = genId();

      const url = new URL(window.location.href);
      url.searchParams.set("matchId", matchId);

      window.location.href = url.toString();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();