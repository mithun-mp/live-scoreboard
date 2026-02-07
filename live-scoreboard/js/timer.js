/* timer.js
   ------------------------------------------------
   High-precision match timer renderer
   - Uses requestAnimationFrame
   - Interpolates time based on state.timer (baseMs + delta)
*/

const Timer = (function (Utils) {

  function createRenderer({ onRender }) {
    if (typeof onRender !== 'function')
      throw new Error('Timer: onRender required');

    let rafId = null;
    let currentStateTimer = null;

    function computeElapsed() {
      if (!currentStateTimer) return 0;
      
      const { running, startTs, baseMs } = currentStateTimer;
      if (!running) return baseMs;
      
      const now = Date.now();
      // If startTs is missing (shouldn't happen if running), fallback to baseMs
      if (!startTs) return baseMs;
      
      return baseMs + (now - startTs);
    }

    function tick() {
      const elapsedMs = computeElapsed();
      onRender(elapsedMs);
      rafId = requestAnimationFrame(tick);
    }

    function start(timerState) {
      currentStateTimer = timerState;
      try { Utils.debug('timer:start', { running: timerState && timerState.running, baseMs: timerState && timerState.baseMs }); } catch {}
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function updateState(timerState) {
      currentStateTimer = timerState;
      try { Utils.debug('timer:update', { running: timerState && timerState.running, baseMs: timerState && timerState.baseMs }); } catch {}
    }

    function stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
        try { Utils.debug('timer:stop'); } catch {}
      }
    }

    return {
      start,
      updateState,
      stop
    };
  }

  return { createRenderer };

})(window.Utils);

/* Global export */
try {
  window.Timer = window.Timer || Timer;
  console.info('[Timer] ready');
} catch {}
