/* Display UI logic (read-only)
   - Listens for window 'ls:message' and updates DOM accordingly
   - Uses Timer.createRenderer to show accurate running timer without polling
   - Important: never call matchState methods; display is read-only
*/

(function () {
  // Boilerplate: parse matchId from URL query or fallback to 'local'
  const params = new URLSearchParams(location.search || '');
  const matchId = params.get('matchId') || 'local';

  const Utils = window.Utils;
  const SyncLib = window.Sync;

  if (!Utils || !SyncLib) {
    console.error('Display missing core libs');
    return;
  }

  const sync = SyncLib.create(matchId, 'display');

  let latestState = null;

  // Efficient DOM updates: cache nodes and update textContent only when changed
  const dom = {
    homeName: document.querySelector('[data-bind="team-home-name"]'),
    awayName: document.querySelector('[data-bind="team-away-name"]'),
    homeScore: document.querySelector('[data-bind="score-home"]'),
    awayScore: document.querySelector('[data-bind="score-away"]'),
    timerText: document.querySelector('[data-bind="timer-text"]'),
    overlay: document.querySelector('[data-bind="goal-overlay"]')
  };

  function applyState(state) {
    if (!state) return;
    latestState = state;
    const teams = state.teams || {};
    // Update only changed nodes
    if (dom.homeName && dom.homeName.textContent !== (teams.home && teams.home.name)) dom.homeName.textContent = teams.home ? teams.home.name : 'Home';
    if (dom.awayName && dom.awayName.textContent !== (teams.away && teams.away.name)) dom.awayName.textContent = teams.away ? teams.away.name : 'Away';
    if (dom.homeScore && dom.homeScore.textContent !== String(state.score.home)) dom.homeScore.textContent = String(state.score.home || 0);
    if (dom.awayScore && dom.awayScore.textContent !== String(state.score.away)) dom.awayScore.textContent = String(state.score.away || 0);

    // Goal overlay
    if (dom.overlay) {
      const show = state.uiFlags && state.uiFlags.showGoalOverlay;
      dom.overlay.style.display = show ? 'block' : 'none';
    }
  }

  // Timer renderer
  const timerRenderer = Timer.createRenderer(
    () => (latestState && latestState.timer) || { running: false, elapsedMs: 0 },
    (text, ms) => {
      if (dom.timerText && dom.timerText.textContent !== text) dom.timerText.textContent = text;
    }
  );

  // Start renderer when loaded
  document.addEventListener('DOMContentLoaded', () => {
    timerRenderer.start();
  });

  // Listen for sync events from controller
  window.addEventListener('ls:message', (ev) => {
    try {
      const msg = ev && ev.detail;
      if (!msg || msg.matchId !== matchId) return;
      // Only accept authoritative state messages from controller role
      if (msg.type === 'state' && msg.payload && msg.originRole === 'controller') {
        applyState(msg.payload);
      }
    } catch (err) {
      console.error('ls:message handler error', err);
    }
  });
})();