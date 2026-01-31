/* Controller UI logic
   - Handles match control, scoring, substitutions, timer
   - Loads pre-match setup (team names, logos, duration)
   - Broadcasts updates to displays via Sync
   - Fully interactive with input modals for scorer and substitutions
*/

(function () {
  if (!window.location.search) return; // basic guard
  const params = new URLSearchParams(location.search);
  const matchId = params.get('matchId') || 'local';

  const Utils = window.Utils;
  const SyncLib = window.Sync;
  const MatchStateFactory = window.MatchState;

  if (!Utils || !SyncLib || !MatchStateFactory) {
    console.error('Controller dependencies missing');
    return;
  }

  // ------------------- Setup MatchState and Sync -------------------
  const sync = SyncLib.create(matchId, 'controller');
  const match = MatchStateFactory.create(matchId, null, sync);

  // ------------------- Load Pre-Match Setup -------------------
  let setupData = null;
  try {
    setupData = JSON.parse(localStorage.getItem(`${matchId}:setup`));
  } catch (err) { console.warn('No pre-match setup found', err); }

  if (setupData) {
    match.setStatePatch({
      teams: {
        home: { ...match.getState().teams.home, ...setupData.home },
        away: { ...match.getState().teams.away, ...setupData.away }
      },
      matchDurationMs: setupData.matchDuration || 90 * 60 * 1000
    });
  }

  // ------------------- Render Teams and Logos -------------------
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
    } catch (err) { console.warn('Logo loading error', err); }
  }

  renderSetupTeams();

  // ------------------- Display Presence -------------------
  const displayPresence = new Map();
  function pruneAndCountDisplays() {
    const now = Utils.nowTs();
    const threshold = 15000;
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
    const msg = ev?.detail;
    if (!msg || msg.matchId !== matchId) return;

    if (msg.type === 'presence' && msg.originRole === 'display') {
      const id = msg.originId || Utils.uuid();
      displayPresence.set(id, msg.ts || Utils.nowTs());
      updateDisplayCountUI();
    }
  });

  // ------------------- State Update Listener -------------------
  window.addEventListener('ls:message', (ev) => {
    const msg = ev?.detail;
    if (!msg || msg.matchId !== matchId) return;
    if (msg.type !== 'state' || !msg.payload) return;

    const s = msg.payload;
    const homeName = document.querySelector('[data-bind="team-home-name"]');
    const awayName = document.querySelector('[data-bind="team-away-name"]');
    const homeScore = document.querySelector('[data-bind="score-home"]');
    const awayScore = document.querySelector('[data-bind="score-away"]');
    const periodNode = document.querySelector('[data-bind="period"]');
    const timerNode = document.querySelector('[data-bind="timer"]');

    if (homeName) homeName.textContent = s.teams.home.name;
    if (awayName) awayName.textContent = s.teams.away.name;
    if (homeScore) homeScore.textContent = s.score.home ?? 0;
    if (awayScore) awayScore.textContent = s.score.away ?? 0;
    if (periodNode) periodNode.textContent = s.period;
    if (timerNode) timerNode.textContent = Utils.formatMs(s.timer.elapsedMs ?? 0);
  });

  // ------------------- DOM Buttons -------------------
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
    const btnAddSub = document.querySelectorAll('[data-action^="sub-"]');

    // ------------------- Goals -------------------
    if (btnGoalHome) btnGoalHome.addEventListener('click', () => addGoal('home'));
    if (btnGoalAway) btnGoalAway.addEventListener('click', () => addGoal('away'));
    if (btnUndo) btnUndo.addEventListener('click', () => match.undoLastGoal());

    // ------------------- Timer -------------------
    if (btnStart) btnStart.addEventListener('click', () => match.startTimer());
    if (btnPause) btnPause.addEventListener('click', () => match.pauseTimer());

    // ------------------- Half-time / Period -------------------
    if (btnStartFirst) btnStartFirst.addEventListener('click', () => match.startFirstHalf());
    if (btnHalfTime) btnHalfTime.addEventListener('click', () => match.halftime());
    if (btnStartSecond) btnStartSecond.addEventListener('click', () => match.startSecondHalf());
    if (btnEndMatch) btnEndMatch.addEventListener('click', () => match.endMatch());
  }

  // ------------------- Keyboard Shortcuts -------------------
  function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      switch (ev.key.toLowerCase()) {
        case 'g': addGoal('home'); ev.preventDefault(); break;
        case 'h': addGoal('away'); ev.preventDefault(); break;
        case 'z': match.undoLastGoal(); ev.preventDefault(); break;
        case ' ': ev.preventDefault(); 
          const t = match.getState().timer;
          t.running ? match.pauseTimer() : match.startTimer();
          break;
      }
    });
  }

  // ------------------- Goal Entry Modal -------------------
  function addGoal(team) {
    const scorer = prompt(`Enter ${team.toUpperCase()} scorer name/jersey:`);
    if (!scorer) return;
    const elapsed = match.getState().timer.elapsedMs || 0;
    match.recordGoal(team, { scorer, timeMs: elapsed });
  }

  // ------------------- Initialize -------------------
  document.addEventListener('DOMContentLoaded', () => {
    bindDom();
    bindKeyboardShortcuts();
    renderSetupTeams();
  });

})();