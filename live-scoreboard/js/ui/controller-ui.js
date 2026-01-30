/* Controller UI logic
   - Binds DOM controls to matchState API
   - Registers keyboard shortcuts and undo
   - NEVER reads from display (no direct DOM operations on display)
   - Uses the matchState methods to mutate authoritative state
*/

(function () {
  // PSEUDO-CODE:
  // - On load: bootstrap MatchState and Sync for given matchId
  // - Wire buttons: goal home/away, start/pause timer, reset
  // - Implement keyboard shortcuts:
  //     G = goal home, H = goal away (example)
  //     Space = toggle timer
  //     Z = undo last goal
  // - Keep undo stack managed in matchState.events (controller-side)
  // - Always call matchState.* methods to mutate, which will broadcast via Sync

  // The boot file should have already attached window.MatchStateFactory and window.SyncFactory
  if (!window.location.search) return; // basic guard
  const params = new URLSearchParams(location.search);
  const matchId = params.get('matchId') || 'local';

  // We expect these globals to be available; if not, the boot script must wire them.
  const Utils = window.Utils;
  const SyncLib = window.Sync;
  const MatchStateFactory = window.MatchState;

  if (!Utils || !SyncLib || !MatchStateFactory) {
    console.error('Controller boot missing dependencies');
    return;
  }

  // Create a sync instance in controller role and inject it into the MatchState
  const sync = SyncLib.create(matchId, 'controller');
  const match = MatchStateFactory.create(matchId, null, sync);

  // Listen for authoritative state messages from other controllers (recovery/restore)
  window.addEventListener('ls:message', (ev) => {
    try {
      const msg = ev && ev.detail;
      if (!msg || msg.matchId !== matchId) return;
      // Only accept state messages from other controllers (not displays)
      if (msg.type === 'state' && msg.payload && msg.originRole === 'controller' && msg.originId !== sync._internal.originId) {
        // apply remote without rebroadcasting
        if (typeof match.applyRemote === 'function') match.applyRemote(msg.payload, msg);
      }
    } catch (err) {
      console.error('ls:message controller handler error', err);
    }
  });

  function bindDom() {
    const btnGoalHome = document.querySelector('[data-action="goal-home"]');
    const btnGoalAway = document.querySelector('[data-action="goal-away"]');
    const btnStart = document.querySelector('[data-action="start-timer"]');
    const btnPause = document.querySelector('[data-action="pause-timer"]');
    const btnUndo = document.querySelector('[data-action="undo"]');

    if (btnGoalHome) btnGoalHome.addEventListener('click', () => match.recordGoal('home'));
    if (btnGoalAway) btnGoalAway.addEventListener('click', () => match.recordGoal('away'));
    if (btnStart) btnStart.addEventListener('click', () => match.startTimer());
    if (btnPause) btnPause.addEventListener('click', () => match.pauseTimer());
    if (btnUndo) btnUndo.addEventListener('click', () => match.undoLastGoal());
  }

  function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return; // avoid interfering with system shortcuts
      switch (ev.key) {
        case 'g': // home goal
        case 'G':
          match.recordGoal('home');
          ev.preventDefault();
          break;
        case 'h': // away goal
        case 'H':
          match.recordGoal('away');
          ev.preventDefault();
          break;
        case ' ':
          // space toggles timer
          ev.preventDefault();
          const st = match.getState().timer;
          if (st && st.running) match.pauseTimer();
          else match.startTimer();
          break;
        case 'z':
        case 'Z':
          match.undoLastGoal();
          ev.preventDefault();
          break;
        default:
          break;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindDom();
    bindKeyboardShortcuts();
    // Optionally render controller UI from state snapshot
    // ... (light-weight DOM updates)
  });
})();