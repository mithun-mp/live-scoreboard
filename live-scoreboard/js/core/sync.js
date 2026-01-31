/* sync.js
   Real-time synchronization for controller & display
   - Uses BroadcastChannel if available
   - Falls back to localStorage events
   - Provides presence and state broadcast
*/

const Sync = (function (Utils) {

  function create(matchId, role = 'controller') {
    if (!matchId) throw new Error('matchId required for Sync');

    const originId = Utils.uuid();
    const channelName = `live-scoreboard:${matchId}`;
    const seenMessages = new Set();

    let bc = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(channelName);
      bc.addEventListener('message', (ev) => handleIncoming(ev.data));
    } else {
      console.warn('BroadcastChannel not available, falling back to localStorage');
      window.addEventListener('storage', (ev) => {
        if (ev.key === channelName && ev.newValue) {
          try {
            const data = JSON.parse(ev.newValue);
            handleIncoming(data);
          } catch {}
        }
      });
    }

    const listeners = [];

    function handleIncoming(msg) {
      if (!msg || seenMessages.has(msg.id) || msg.originId === originId) return;
      seenMessages.add(msg.id);

      listeners.forEach(fn => {
        try { fn(msg); } catch (e) { console.error('Sync listener error', e); }
      });
    }

    function broadcast(payload) {
      const msg = {
        id: Utils.uuid(),
        matchId,
        originId,
        originRole: role,
        ts: Utils.nowTs(),
        payload,
        type: payload.type || 'state'
      };

      seenMessages.add(msg.id);

      // BroadcastChannel first
      if (bc) {
        bc.postMessage(msg);
      }

      // Fallback localStorage
      try {
        localStorage.setItem(channelName, JSON.stringify(msg));
        // Cleanup to prevent accumulation
        setTimeout(() => localStorage.removeItem(channelName), 100);
      } catch (e) { console.warn('localStorage broadcast failed', e); }
    }

    function onMessage(fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return () => {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    }

    // Presence ping (for displays connected)
    function ping() {
      broadcast({ type: 'presence', role, originId, ts: Utils.nowTs() });
    }

    // Auto-ping every 5 seconds
    const pingInterval = setInterval(ping, 5000);
    ping();

    return {
      broadcast,
      onMessage,
      ping,
      _internal: { originId },
      destroy() {
        clearInterval(pingInterval);
        if (bc) bc.close();
      }
    };
  }

  return { create };

})(Utils);

try {
  window.Sync = window.Sync || Sync;
  console.info('[Sync] Global export ready');
} catch {}