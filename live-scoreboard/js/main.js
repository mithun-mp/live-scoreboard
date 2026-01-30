/* main.js
   - Minimal entry point; preserved for future ES-module wiring.
   - Current codebase uses globals (Utils, Sync, MatchState). This file provides
   - a tiny App helper for templates and quick boot diagnostics.
*/
(function () {
  window.App = window.App || {};
  window.App.genMatchId = function () {
    if (window.Utils && typeof window.Utils.uuid === 'function') return window.Utils.uuid();
    return 'ms-' + Math.random().toString(36).slice(2, 10);
  };
})();
