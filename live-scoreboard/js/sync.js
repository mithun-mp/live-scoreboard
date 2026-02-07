/* sync.js
   ------------------------------------------------
   Realtime sync layer for Live Scoreboard
   - Controller = authoritative
   - Display = read-only
   - BroadcastChannel with localStorage fallback
*/

const Sync = (function (Utils) {

  function create(matchId, role = 'controller') {
    if (!matchId) throw new Error('Sync: matchId required');

    const originId = Utils.uuid();
    const channelName = `live-scoreboard:${matchId}`;
    const seenIds = new Set();
    const listeners = [];

    let bc = null;

    /* ---------------- Channel Setup ---------------- */

    function handleIncoming(msg) {
      if (!msg || msg.matchId !== matchId) return;
      if (msg.originId === originId) return;
      if (seenIds.has(msg.id)) return;

      seenIds.add(msg.id);
      try { Utils.debug('sync:incoming', { matchId, from: msg.originId, role: msg.role, type: msg.payload && msg.payload.type }); } catch {}

      listeners.forEach(fn => {
        try {
          fn(msg);
        } catch (e) {
          console.error('[Sync] listener error', e);
        }
      });
    }

    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(channelName);
      bc.onmessage = ev => handleIncoming(ev.data);
    } else {
      window.addEventListener('storage', ev => {
        if (ev.key === channelName && ev.newValue) {
          try {
            handleIncoming(JSON.parse(ev.newValue));
          } catch {}
        }
      });
    }

    /* ---------------- Broadcast ---------------- */

    function broadcast(payload) {
      if (role !== 'controller') return; // HARD BLOCK

      const msg = {
        id: Utils.uuid(),
        matchId,
        originId,
        role,
        ts: Utils.nowTs(),
        payload
      };

      seenIds.add(msg.id);

      if (bc) bc.postMessage(msg);
      try { Utils.debug('sync:broadcast', { matchId, originId, role, type: payload && payload.type }); } catch {}

      try {
        localStorage.setItem(channelName, JSON.stringify(msg));
        setTimeout(() => localStorage.removeItem(channelName), 50);
      } catch (e) {
        console.warn('[Sync] localStorage broadcast failed', e);
      }
    }

    /* ---------------- API ---------------- */

    function onMessage(fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }

    /* ---------------- Presence ---------------- */

    function ping() {
      const msg = {
        id: Utils.uuid(),
        matchId,
        originId,
        role,
        ts: Utils.nowTs(),
        payload: { type: 'presence' }
      };

      if (bc) bc.postMessage(msg);
    }

    const pingTimer = setInterval(ping, 5000);
    ping();

    /* ---------------- Cleanup ---------------- */

    function destroy() {
      clearInterval(pingTimer);
      if (bc) bc.close();
      listeners.length = 0;
      seenIds.clear();
    }

    return {
      broadcast,
      onMessage,
      ping,
      destroy,
      _debug: { originId, role }
    };
  }

  return { create };

})(Utils);

/* Global export */
try {
  window.Sync = window.Sync || Sync;
  console.info('[Sync] ready');
} catch {}
