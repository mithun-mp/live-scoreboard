/* Controller UI logic
   - Binds DOM controls to matchState API
   - Registers keyboard shortcuts and undo
   - NEVER reads from display (no direct DOM operations on display)
   - Uses the matchState methods to mutate authoritative state
   - Integrates pre-match setup: team names, logos, match duration
*/

(function () {
  if (!window.location.search) return; // basic guard
  const params = new URLSearchParams(location.search);
  const matchId = params.get('matchId') || 'local';

  const Utils = window.Utils;
  const SyncLib = window.Sync;
  const MatchStateFactory = window.MatchState;

  if (!Utils || !SyncLib || !MatchStateFactory) {
    console.error('Controller boot missing dependencies');
    return;
  }

  // -------------------- Create Sync and MatchState --------------------
  const sync = SyncLib.create(matchId, 'controller');
  const match = MatchStateFactory.create(matchId, null, sync);

  // -------------------- Load pre-match setup --------------------
  let setupData = null;
  try {
    const raw = localStorage.getItem(`${matchId}:setup`);
    if (raw) setupData = JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load pre-match setup', err);
  }

  if (setupData) {
    match.setStatePatch({
      teams: {
        home: { ...match.getState().teams.home, ...setupData.home },
        away: { ...match.getState().teams.away, ...setupData.away }
      },
      matchDurationMs: setupData.matchDuration || 90 * 60 * 1000
    });
  }

  // -------------------- Render pre-match setup UI --------------------
  function renderSetupTeams() {
    if (!setupData) return;

    const homeNameNode = document.querySelector('[data-bind="team-home-name"]');
    const awayNameNode = document.querySelector('[data-bind="team-away-name"]');
    const homeLogoNode = document.querySelector('[data-bind="team-home-logo"]');
    const awayLogoNode = document.querySelector('[data-bind="team-away-logo"]');

    if (homeNameNode) homeNameNode.textContent = setupData.home.name;
    if (awayNameNode) awayNameNode.textContent = setupData.away.name;

    try {
      const homeLogo = localStorage.getItem(`${matchId}:homeLogo`);
      const awayLogo = localStorage.getItem(`${matchId}:awayLogo`);
      if (homeLogo && homeLogoNode) homeLogoNode.src = homeLogo;
      if (awayLogo && awayLogoNode) awayLogoNode.src = awayLogo;
    } catch (err) {
      console.warn('Failed to load logos', err);
    }
  }

  renderSetupTeams();

  // -------------------- Listen for remote state messages --------------------
  window.addEventListener('ls:message', (ev) => {
    try {
      const msg = ev && ev.detail;
      if (!msg || msg.matchId !== matchId) return;
      if (msg.type === 'state' && msg.payload && msg.originRole === 'controller' && msg.originId !== sync._internal.originId) {
        if (typeof match.applyRemote === 'function') match.applyRemote(msg.payload, msg);
      }
    } catch (err) {
      console.error('ls:message controller handler error', err);
    }
  });

  // -------------------- Track connected displays --------------------
  const displayPresence = new Map(); // originId -> lastSeenTs
  function pruneAndCountDisplays() {
    const now = Utils.nowTs();
    const threshold = 15000; // consider display offline if no ping in 15s
    for (const [id, ts] of Array.from(displayPresence.entries())) {
      if (now - ts > threshold) displayPresence.delete(id);
    }
    return displayPresence.size;
  }

  function updateDisplayCountUI() {
    const node = document.querySelector('[data-bind="display-count"]');
    if (!node) return;
    node.textContent = String(pruneAndCountDisplays());
  }

  window.addEventListener('ls:message', (ev) => {
    try {
      const msg = ev && ev.detail;
      if (!msg || msg.matchId !== matchId) return;
      if (msg.type === 'presence' && msg.originRole === 'display') {
        const id = msg.originId || (msg.payload && msg.payload.id) || Utils.uuid();
        displayPresence.set(id, msg.ts || Utils.nowTs());
        updateDisplayCountUI();
      }
    } catch (e) { /* noop */ }
  });

  // -------------------- Bind DOM controls --------------------
  function bindDom() {
    const btnGoalHome = document.querySelector('[data-action="goal-home"]');
    const btnGoalAway = document.querySelector('[data-action="goal-away"]');
    const btnStart = document.querySelector('[data-action="start-timer"]');
    const btnPause = document.querySelector('[data-action="pause-timer"]');
    const btnUndo = document.querySelector('[data-action="undo"]');

    const btnStartFirst = document.querySelector('[data-action="start-first-half"]');
    const btnHalfTime = document.querySelector('[data-action="half-time"]');
    const btnStartSecond = document.querySelector('[data-action="start-second-half"]');
    const btnEndMatch = document.querySelector('[data-action="end-match"]');

    if (btnGoalHome) btnGoalHome.addEventListener('click', () => match.recordGoal('home'));
    if (btnGoalAway) btnGoalAway.addEventListener('click', () => match.recordGoal('away'));
    if (btnStart) btnStart.addEventListener('click', () => match.startTimer());
    if (btnPause) btnPause.addEventListener('click', () => match.pauseTimer());
    if (btnUndo) btnUndo.addEventListener('click', () => match.undoLastGoal());

    if (btnStartFirst) btnStartFirst.addEventListener('click', () => match.startFirstHalf());
    if (btnHalfTime) btnHalfTime.addEventListener('click', () => match.halftime());
    if (btnStartSecond) btnStartSecond.addEventListener('click', () => match.startSecondHalf());
    if (btnEndMatch) btnEndMatch.addEventListener('click', () => match.endMatch());
  }

  // -------------------- Keyboard shortcuts --------------------
  function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      switch (ev.key) {
        case 'g':
        case 'G':
          match.recordGoal('home'); ev.preventDefault(); break;
        case 'h':
        case 'H':
          match.recordGoal('away'); ev.preventDefault(); break;
        case ' ':
          ev.preventDefault();
          const st = match.getState().timer;
          if (st && st.running) match.pauseTimer();
          else match.startTimer();
          break;
        case 'z':
        case 'Z':
          match.undoLastGoal(); ev.preventDefault(); break;
        default: break;
      }
    });
  }

  // -------------------- Timer helper for match duration --------------------
  function getTimerState() {
    const st = match.getState().timer;
    const maxMs = match.getState().matchDurationMs || 90 * 60 * 1000;
    let elapsed = st.elapsedMs || 0;
    if (st.running && st.lastStartTs) elapsed += Utils.nowTs() - st.lastStartTs;
    if (elapsed > maxMs) elapsed = maxMs; // cap to match duration
    return { ...st, elapsedMs: elapsed };
  }

  // -------------------- Initial render --------------------
  document.addEventListener('DOMContentLoaded', () => {
    bindDom();
    bindKeyboardShortcuts();

    // Render current snapshot immediately
    try {
      const st = match.getState();
      const periodNode = document.querySelector('[data-bind="period"]');
      if (periodNode && st && st.period) periodNode.textContent = st.period;
    } catch (e) { /* noop */ }
  });

  // -------------------- Render updates on state changes --------------------
  window.addEventListener('ls:message', (ev) => {
    try {
      const msg = ev && ev.detail;
      if (!msg || msg.matchId !== matchId) return;
      if (msg.type !== 'state' || !msg.payload) return;

      const s = msg.payload;
      const homeName = document.querySelector('[data-bind="team-home-name"]');
      const awayName = document.querySelector('[data-bind="team-away-name"]');
      const homeScore = document.querySelector('[data-bind="score-home"]');
      const awayScore = document.querySelector('[data-bind="score-away"]');
      const periodNode = document.querySelector('[data-bind="period"]');

      if (homeName && homeName.textContent !== (s.teams && s.teams.home && s.teams.home.name)) homeName.textContent = s.teams.home.name;
      if (awayName && awayName.textContent !== (s.teams && s.teams.away && s.teams.away.name)) awayName.textContent = s.teams.away.name;
      if (homeScore && String(homeScore.textContent) !== String(s.score && s.score.home)) homeScore.textContent = String(s.score.home || 0);
      if (awayScore && String(awayScore.textContent) !== String(s.score && s.score.away)) awayScore.textContent = String(s.score.away || 0);
      if (periodNode && String(periodNode.textContent) !== String(s.period)) periodNode.textContent = s.period;
    } catch (err) {
      console.error('controller ls:message render error', err);
    }
  });

})();