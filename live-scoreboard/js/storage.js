// js/storage.js

const STORAGE_KEY = "LIVE_SCOREBOARD_STATE";

/**
 * Save state to localStorage
 * - Serializes state to JSON
 * - Gracefully handles quota exceeded and parse errors
 * - Never crashes the application
 * @param {Object} state - The state object to persist
 */
export function saveState(state) {
  try {
    if (!state || typeof state !== "object") {
      console.warn("⚠️ Invalid state format for storage", state);
      return;
    }

    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    console.log("💾 State saved to localStorage");
  } catch (err) {
    // Handle quota exceeded, security errors, etc.
    if (err.name === "QuotaExceededError") {
      console.error("💥 localStorage quota exceeded:", err.message);
    } else if (err.name === "SecurityError") {
      console.error("🔒 localStorage access denied (private browsing?):", err.message);
    } else {
      console.error("❌ Failed to save state:", err);
    }
    // Continue running - storage failure is not fatal
  }
}

/**
 * Load state from localStorage
 * - Parses JSON safely
 * - Returns null if key doesn't exist
 * - Returns null if parse fails (with warning)
 * - Never crashes the application
 * @returns {Object|null} - The stored state or null
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    // No stored state
    if (!raw) {
      console.log("📂 No stored state found");
      return null;
    }

    const parsed = JSON.parse(raw);
    console.log("📖 State loaded from localStorage");
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn("⚠️ Stored state is corrupted (invalid JSON):", err.message);
    } else if (err.name === "SecurityError") {
      console.warn("🔒 Cannot access localStorage (private browsing?):", err.message);
    } else {
      console.warn("⚠️ Failed to load state:", err);
    }
    // Continue running with null state - let caller use DEFAULT_STATE
    return null;
  }
}

/**
 * Clear stored state from localStorage
 * - Safe to call even if key doesn't exist
 */
export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("🗑️ State cleared from localStorage");
  } catch (err) {
    console.warn("⚠️ Failed to clear state:", err);
    // Continue running - clearing is not critical
  }
}