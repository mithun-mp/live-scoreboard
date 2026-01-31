(function() {
  const params = new URLSearchParams(location.search);
  const matchId = params.get('matchId') || 'local';

  const Utils = window.Utils;
  const SyncLib = window.Sync;
  const MatchStateFactory = window.MatchState;

  if (!Utils || !SyncLib || !MatchStateFactory) return;

  const sync = SyncLib.create(matchId, 'display');
  const match = MatchStateFactory.create(matchId, null, sync);

  // Render updates
  function renderState(s) {
    const homeName = document.querySelector('[data-bind="team-home-name"]');
    const awayName = document.querySelector('[data-bind="team-away-name"]');
    const homeScore = document.querySelector('[data-bind="score-home"]');
    const awayScore = document.querySelector('[data-bind="score-away"]');
    const periodNode = document.querySelector('[data-bind="period"]');
    const timerNode = document.querySelector('[data-bind="timer"]');

    if(homeName) homeName.textContent = s.teams.home.name;
    if(awayName) awayName.textContent = s.teams.away.name;
    if(homeScore) homeScore.textContent = s.score.home || 0;
    if(awayScore) awayScore.textContent = s.score.away || 0;
    if(periodNode) periodNode.textContent = s.period;
    if(timerNode) timerNode.textContent = s.timer ? s.timer.display : '00:00';
  }

  // Listen for state updates
  window.addEventListener('ls:message', ev => {
    const msg = ev.detail;
    if(!msg || msg.matchId !== matchId) return;
    if(msg.type === 'state' && msg.payload) {
      renderState(msg.payload);

      // Event animations example
      if(msg.payload.lastEvent === 'goal') {
        const anim = document.createElement('div');
        anim.className = 'goal-animation';
        anim.textContent = 'GOAL!';
        document.querySelector('.event-animations').appendChild(anim);
        setTimeout(() => anim.remove(), 2000);
      }
    }
  });
})();