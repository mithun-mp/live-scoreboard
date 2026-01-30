// js/main.js
/**
 * Bootstrap the scoreboard application:
 * 1. Load persisted state from storage
 * 2. Start BroadcastChannel listener for cross-tab sync
 * 3. Subscribe to state changes and broadcast updates
 * 4. Expose debug helpers on window object
 */

import { subscribe, replaceState, getState, updateState } from "./state.js";
import { loadState } from "./storage.js";
import { broadcastState, listenForSync } from "./sync.js";
import { startTimer, pauseTimer, resetTimer, addExtraTime } from "./timer.js";

console.log("⚙️ Initializing scoreboard application...");

// Step 1: Restore persisted state from localStorage
const saved = loadState();
if (saved) {
  console.log("📂 Restoring saved state");
  replaceState(saved);
} else {
  console.log("🆕 Starting with default state");
}

// Step 2: Start listening for incoming sync messages from other tabs
console.log("👂 Starting BroadcastChannel listener");
listenForSync();

// Step 3: Subscribe to state changes and broadcast to other tabs
subscribe((state) => {
  broadcastState(state);
});

// Step 4: Expose debug helpers on window object
// Usage in console:
//   window.getState() - view current state
//   window.updateState({ teams: { home: { score: 1 } } }) - partial update
//   window.replaceState(newState) - full state replacement
window.getState = getState;
window.updateState = updateState;
window.replaceState = replaceState;

console.log("✅ Scoreboard application initialized successfully");