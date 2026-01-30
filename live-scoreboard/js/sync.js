// js/sync.js

import { replaceState } from "./state.js";
import { saveState } from "./storage.js";

// Generate unique client ID for this tab
const CLIENT_ID = `tab-${Date.now()}-${Math.random().toString(36).substring(7)}`;

// BroadcastChannel for cross-tab communication
const channel = new BroadcastChannel("live-score-sync");

// Flag to suppress broadcasts when applying remote state
let broadcastSuppressed = false;

console.log(`📡 BroadcastChannel initialized [Client: ${CLIENT_ID}]`);

/**
 * Broadcast state to other tabs
 * - Do NOT broadcast if suppression flag is active (prevents loops)
 * - Send state with sender ID
 * - Persist state to localStorage
 * @param {Object} state - The state to broadcast
 */
export function broadcastState(state) {
  if (broadcastSuppressed) {
    console.log("🔇 Broadcast suppressed (remote update in progress)");
    broadcastSuppressed = false;
    return;
  }

  const message = {
    sender: CLIENT_ID,
    payload: state
  };

  console.log("📤 Broadcasting state from", CLIENT_ID);
  channel.postMessage(message);
  saveState(state);
}

/**
 * Listen for state synchronization from other tabs
 * - Ignore messages from the same CLIENT_ID
 * - Suppress next local broadcast to prevent loops
 * - Apply remote state changes
 */
export function listenForSync() {
  channel.onmessage = (event) => {
    const message = event.data;

    // Validate message structure
    if (!message || typeof message !== "object" || !message.sender || !message.payload) {
      console.warn("⚠️ Invalid sync message received", message);
      return;
    }

    const { sender, payload } = message;

    // Ignore messages from this tab
    if (sender === CLIENT_ID) {
      console.log("🔄 Ignoring own message from", sender);
      return;
    }

    console.log(`📥 Received state from ${sender}`);
    
    // Suppress next local broadcast to prevent infinite loop
    broadcastSuppressed = true;
    replaceState(payload);
  };
}