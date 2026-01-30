/* Utility helpers for live-scoreboard
   - Small, dependency-free helpers used across modules
   - Keep pure and defensive (no DOM here)
*/
const Utils = (function () {
  // Generate RFC4122 v4-like UUID (small, not crypto-critical)
  function uuid() {
    return 'xxxyxxyx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function isObject(o) {
    return o && typeof o === 'object' && !Array.isArray(o);
  }

  // Deep merge: merge properties of src into target (immutable)
  function deepMerge(target, src) {
    if (!isObject(target)) target = {};
    if (!isObject(src)) return target;
    const out = Array.isArray(target) ? target.slice() : Object.assign({}, target);
    Object.keys(src).forEach((k) => {
      const sv = src[k];
      const tv = out[k];
      if (isObject(sv)) {
        out[k] = deepMerge(tv || {}, sv);
      } else {
        out[k] = sv;
      }
    });
    return out;
  }

  function nowTs() {
    return Date.now();
  }

  return { uuid, deepMerge, isObject, nowTs };
})();