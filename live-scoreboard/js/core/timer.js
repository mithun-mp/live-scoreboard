/* Timer helper and renderer
   - Supports adjustable match duration
   - Handles added time
   - Triggers milestones (halftime / fulltime)
   - Smooth requestAnimationFrame updates
   - Decoupled from UI: accepts callbacks
*/

const Timer = (function (Utils) {
  // Format milliseconds to MM:SS
  function formatMs(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * createRenderer
   * @param {Function} getTimerState - returns { running, elapsedMs, lastStartTs }
   * @param {Function} getRules - returns { baseDurationMs, addedTimeMs, period }
   * @param {Function} onRender - callback(visibleTimeText, elapsedMs, targetMs)
   * @param {Function} onMilestone - callback({ period, elapsedMs, targetMs })
   */
  function createRenderer({ getTimerState, getRules, onRender, onMilestone }) {
    if (typeof getTimerState !== 'function') throw new Error('getTimerState required');
    if (typeof getRules !== 'function') throw new Error('getRules required');
    if (typeof onRender !== 'function') throw new Error('onRender required');

    let rafId = null;
    let lastRenderMs = 0;
    let milestonesFired = new Set();

    function tick() {
      const now = Utils.nowTs();
      const timer = getTimerState();
      const rules = getRules();

      // Compute elapsed
      let elapsed = timer.elapsedMs || 0;
      if (timer.running && timer.lastStartTs) {
        elapsed += now - timer.lastStartTs;
      }

      // Total target duration (base + added)
      const targetMs = (rules.baseDurationMs || 0) + (rules.addedTimeMs || 0);

      // Trigger milestone if elapsed exceeds target
      if (elapsed >= targetMs && !milestonesFired.has(rules.period)) {
        milestonesFired.add(rules.period);
        if (typeof onMilestone === 'function') {
          onMilestone({
            period: rules.period,
            elapsedMs: elapsed,
            targetMs
          });
        }
      }

      // Throttle render (~30fps)
      if (now - lastRenderMs >= 33) {
        lastRenderMs = now;
        onRender(formatMs(elapsed), elapsed, targetMs);
      }

      rafId = window.requestAnimationFrame(tick);
    }

    function start() {
      if (!rafId) rafId = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function resetMilestones() {
      milestonesFired.clear();
    }

    return { start, stop, resetMilestones };
  }

  return { createRenderer };
})(Utils);

// Expose Timer for global access
try {
  window.Timer = window.Timer || Timer;
} catch (e) {
  /* noop */
}