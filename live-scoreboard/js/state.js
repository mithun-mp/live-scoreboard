// js/state.js

export const DEFAULT_STATE = {
  matchId: null,
  status: "PRE_MATCH", // PRE_MATCH | LIVE | HALF_TIME | FULL_TIME

  timer: {
    seconds: 0,
    running: false,
    extraTime: 0
  },

  teams: {
    home: {
      name: "HOME",
      logo: "",
      score: 0,
      scorers: []
    },
    away: {
      name: "AWAY",
      logo: "",
      score: 0,
      scorers: []
    }
  },

  substitutions: [],
  lastUpdated: Date.now()
};

let state = structuredClone(DEFAULT_STATE);
const listeners = new Set();

/**
 * Get a deep cloned copy of the current state
 * Safe for reading without mutating internal state
 * @returns {Object} - Deep clone of current state
 */
export function getState() {
  return structuredClone(state);
}

/**
 * Safely deep-merge patch into state
 * - Only overwrites provided fields
 * - Preserves nested objects (timer, teams.home, teams.away)
 * - Updates lastUpdated timestamp
 */
export function updateState(patch) {
  state = deepMerge(state, patch);
  state.lastUpdated = Date.now();
  notify();
}

/**
 * Deep merge helper: recursively merge patch into target
 * @param {Object} target - The target object
 * @param {Object} patch - The patch to apply
 * @returns {Object} - A new merged object
 */
function deepMerge(target, patch) {
  const result = structuredClone(target);
  
  for (const key in patch) {
    if (patch.hasOwnProperty(key)) {
      const patchValue = patch[key];
      
      // If both are objects (but not arrays), merge recursively
      if (
        patchValue !== null &&
        typeof patchValue === 'object' &&
        !Array.isArray(patchValue) &&
        result[key] !== null &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key], patchValue);
      } else {
        // For primitives, arrays, and other types, just replace
        result[key] = structuredClone(patchValue);
      }
    }
  }
  
  return result;
}

/**
 * Fully replace state (used only for sync restore)
 * @param {Object} newState - The new state object
 */
export function replaceState(newState) {
  state = structuredClone(newState);
  notify();
}

/**
 * Restore state to DEFAULT_STATE
 */
export function resetState() {
  state = structuredClone(DEFAULT_STATE);
  notify();
}

/**
 * Subscribe to state changes
 * @param {Function} fn - Callback function that receives updated state
 * @returns {Function} - Unsubscribe function
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Notify all subscribers of state changes
 */
function notify() {
  listeners.forEach(fn => fn(getState()));
}