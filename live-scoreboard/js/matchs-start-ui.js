(function() {
  const qs = new URLSearchParams(location.search);
  const matchId = qs.get('matchId');
  if (!matchId) return;

  const setupRaw = localStorage.getItem(`${matchId}:setup`);
  if (!setupRaw) return;
  const setup = JSON.parse(setupRaw);

  // DOM
  const teamAImg = document.getElementById('teamAImg');
  const teamBImg = document.getElementById('teamBImg');
  const teamAName = document.getElementById('teamAName');
  const teamBName = document.getElementById('teamBName');
  const countdownEl = document.getElementById('countdown');
  const matchText = document.getElementById('matchText');

  teamAName.textContent = setup.teamA.name;
  teamBName.textContent = setup.teamB.name;
  try {
    const teamALogo = localStorage.getItem(`${matchId}:teamALogo`);
    const teamBLogo = localStorage.getItem(`${matchId}:teamBLogo`);
    if (teamALogo) teamAImg.src = teamALogo;
    if (teamBLogo) teamBImg.src = teamBLogo;
  } catch (e) {}

  // Countdown from 10 to 1 then redirect
  let count = 10;
  const interval = setInterval(() => {
    countdownEl.textContent = count;
    if (count <= 0) {
      clearInterval(interval);
      matchText.textContent = '⚽ LET’S FOOTBALL! ⚽';
      countdownEl.style.display = 'none';
      // Redirect extended page to controller after 2s
      setTimeout(() => {
        window.location.href = `controller.html?matchId=${matchId}`;
      }, 2000);
    }
    count--;
  }, 1000);
})();