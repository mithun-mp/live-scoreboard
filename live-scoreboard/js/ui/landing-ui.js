// Digital clock
function updateClock() {
  const now = new Date();
  const clock = document.getElementById('digitalClock');
  if (!clock) return;
  clock.textContent = now.toLocaleTimeString();
}

setInterval(updateClock, 1000);
updateClock();

// Setup new match button
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('[data-action="create-match"]');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const matchId = 'match-' + Date.now();
    // Redirect to setup page with matchId
    window.location.href = `setup.html?matchId=${matchId}`;
  });
});