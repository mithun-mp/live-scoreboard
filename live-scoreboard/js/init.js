/* init.js – app bootstrap */

(function () {

  const MODE = {
    LANDING: 'landing',
    SETUP: 'setup',
    CONTROLLER: 'controller',
    MATCH_START: 'match-start',
  };

  const qs = () => new URLSearchParams(location.search);
  const matchId = qs().get('matchId');

  function load(src) {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.body.appendChild(s);
  }

  function show(area) {
    document.querySelectorAll('[data-area]').forEach(a => {
      a.style.display = a.dataset.area === area ? '' : 'none';
    });
  }

  function hasSetup(id) {
    try {
      return JSON.parse(localStorage.getItem(`${id}:setup`));
    } catch {
      return null;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {

    if (!matchId) {
      document.body.dataset.mode = MODE.LANDING;
      show(MODE.LANDING);
      return;
    }

    const setup = hasSetup(matchId);

    if (!setup) {
      document.body.dataset.mode = MODE.SETUP;
      show(MODE.SETUP);
      load('js/setup-ui.js');
      return;
    }

    if (document.body.classList.contains('match-start')) {
      document.body.dataset.mode = MODE.MATCH_START;
      show(MODE.MATCH_START);
      load('js/match-start-ui.js');
      return;
    }

    // CONTROLLER
    document.body.dataset.mode = MODE.CONTROLLER;
    show(MODE.CONTROLLER);

    load('js/utils.js');
    load('js/matchstate.js');
    load('js/sync.js');
    load('js/timer.js');
    load('controller-ui.js');
  });

})();