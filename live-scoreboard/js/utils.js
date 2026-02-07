/* utils.js
   ------------------------------------------------
   Shared utility helpers for live-scoreboard
   - Pure functions only
   - No DOM access
   - Safe for controller + display
*/

const Utils = (function () {

  /* -------- UUID -------- */

  // Lightweight UUID v4-like generator (non-crypto)
  function uuid() {
    let d = Date.now();
    let d2 = (performance && performance.now && performance.now() * 1000) || 0;

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      let r = Math.random() * 16;
      if (d > 0) {
        r = (d + r) % 16 | 0;
        d = Math.floor(d / 16);
      } else {
        r = (d2 + r) % 16 | 0;
        d2 = Math.floor(d2 / 16);
      }
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /* -------- Type guards -------- */

  function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  /* -------- Deep clone -------- */

  function deepClone(obj) {
    if (!isObject(obj) && !Array.isArray(obj)) return obj;
    return JSON.parse(JSON.stringify(obj));
  }

  /* -------- Deep merge (immutable) -------- */

  function deepMerge(target, src) {
    if (!isObject(target)) target = {};
    if (!isObject(src)) return deepClone(target);

    const out = Array.isArray(target)
      ? target.slice()
      : Object.assign({}, target);

    Object.keys(src).forEach((key) => {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor') return;

      const sv = src[key];
      const tv = out[key];

      if (isObject(sv)) {
        out[key] = deepMerge(isObject(tv) ? tv : {}, sv);
      } else {
        out[key] = deepClone(sv);
      }
    });

    return out;
  }

  /* -------- Time -------- */

  function nowTs() {
    return Date.now();
  }

  function formatMs(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function debug(tag, data) {
    try {
      const ts = new Date().toISOString();
      if (data !== undefined) {
        console.log(`[DEBUG ${ts}] ${tag}`, data);
      } else {
        console.log(`[DEBUG ${ts}] ${tag}`);
      }
    } catch {
      console.log('[DEBUG]', tag);
    }
  }

  return {
    uuid,
    isObject,
    deepClone,
    deepMerge,
    nowTs,
    formatMs,
    debug
  };
})();

/* Global exposure (non-module usage) */
try {
  window.Utils = window.Utils || Utils;
  console.info('[Utils] ready');
} catch {
  /* ignore */
}
