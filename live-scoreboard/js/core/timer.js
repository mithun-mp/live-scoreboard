/* Timer helper and rAF renderer
   - Computes elapsedMs using lastStartTs + offset safely
   - Export a `createRenderer` that accepts:
       - getTimerState() -> { running, elapsedMs, lastStartTs }
       - onRender(visibleTimeText, ms) -> updates DOM (must be fast)
   - Uses requestAnimationFrame for smooth updates and reduced layout thrashing
*/

// Why separate: timer math often leaks into UI code. Separating ensures a deterministic render loop that can be shared by display and controller.
const Timer = (function (Utils) {
  function formatMs(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function createRenderer(getTimerState, onRender) {
    if (typeof getTimerState !== 'function' || typeof onRender !== 'function') {
      throw new Error('getTimerState and onRender required');
    }
    let rafId = null;
    let lastRenderMs = 0;

    function tick() {
      const ts = Utils.nowTs();
      const st = getTimerState();
      // compute elapsed
      let elapsed = st && typeof st.elapsedMs === 'number' ? st.elapsedMs : 0;
      if (st && st.running && st.lastStartTs) {
        elapsed = elapsed + (ts - st.lastStartTs);
      }
      // Avoid rendering more than ~30fps to save CPU on big displays
      if (ts - lastRenderMs >= 33) {
        lastRenderMs = ts;
        onRender(formatMs(elapsed), elapsed);
      }
      rafId = window.requestAnimationFrame(tick);
    }

    function start() {
      if (rafId) return;
      rafId = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    return { start, stop };
  }

  return { createRenderer };
})(Utils);