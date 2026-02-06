/* timer.js
   ------------------------------------------------
   High-precision match timer (UI-agnostic)
   - Uses requestAnimationFrame
   - Supports added time
   - Fires milestones once per period
   - Reads state, never mutates it
*/

const Timer = (function (Utils) {

  /* -------- Helpers -------- */

  function formatMs(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /* -------- Renderer -------- */

  function createRenderer({
    getTimerState,
    getRules,
    onRender,
    onMilestone
  }) {
    if (typeof getTimerState !== 'function')
      throw new Error('Timer: getTimerState required');

    if (typeof getRules !== 'function')
      throw new Error('Timer: getRules required');

    if (typeof onRender !== 'function')
      throw new Error('Timer: onRender required');

    let rafId = null;
    let lastRenderTs = 0;
    const firedMilestones = new Set();

    function computeElapsed(timer, now) {
      let elapsed = timer.elapsedMs || 0;

      if (
        timer.running &&
        typeof timer.lastStartTs === 'number' &&
        timer.lastStartTs <= now
      ) {
        elapsed += now - timer.lastStartTs;
      }

      return elapsed;
    }

    function tick() {
      const now = Utils.nowTs();
      const timer = getTimerState();
      const rules = getRules();

      if (!timer || !rules) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsedMs = computeElapsed(timer, now);
      const targetMs =
        (rules.baseDurationMs || 0) + (rules.addedTimeMs || 0);

      const milestoneKey = `${rules.period}:${targetMs}`;

      if (
        targetMs > 0 &&
        elapsedMs >= targetMs &&
        !firedMilestones.has(milestoneKey)
      ) {
        firedMilestones.add(milestoneKey);

        if (typeof onMilestone === 'function') {
          onMilestone({
            period: rules.period,
            elapsedMs,
            targetMs
          });
        }
      }

      // ~30 FPS render throttle
      if (now - lastRenderTs >= 33) {
        lastRenderTs = now;
        onRender(formatMs(elapsedMs), elapsedMs, targetMs);
      }

      rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function stop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function resetMilestones() {
      firedMilestones.clear();
    }

    return {
      start,
      stop,
      resetMilestones
    };
  }

  return { createRenderer };

})(Utils);

/* Global export */
try {
  window.Timer = window.Timer || Timer;
  console.info('[Timer] ready');
} catch {}