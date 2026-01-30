/* Reliable in-browser sync layer
   - Uses BroadcastChannel if available, otherwise falls back to localStorage events
   - Ensures no loops, no duplicate processing, basic versioning
   - Emits CustomEvent('ls:message') for same-page listeners
   - Message format:
     { messageId, originId, matchId, type, version, payload, ts }
*/

const Sync = (function (Utils) {
  // Create a sync instance for a matchId with an explicit role.
  // role: 'controller' | 'display' (affects originRole on broadcast and who should be trusted)
  function create(matchId, role) {
    if (!matchId) throw new Error('matchId required for sync layer');
    role = role === 'controller' ? 'controller' : 'display';

    const bcName = `live-scoreboard:${matchId}`;
    let bc = null;
    try {
      if ('BroadcastChannel' in window) bc = new BroadcastChannel(bcName);
    } catch (e) {
      bc = null;
    }

    const originId = Utils.uuid();
    const seen = new Set();
    let lastVersion = -1;

    // Hydrate a small recent message cache from sessionStorage to reduce duplicates
    const sessionKey = `${bcName}:seen`;
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) {
        JSON.parse(raw).forEach((id) => seen.add(id));
      }
    } catch (e) {
      // ignore session storage errors
    }

    // Internal: handle incoming message (from BC or storage)
    // PSEUDO-CODE:
    // - if message missing payload or malformed -> ignore
    // - if messageId already seen -> ignore
    // - if originId === my originId -> ignore (we already processed or originated)
    // - if version <= lastVersion -> ignore (stale update)
    // - update lastVersion and mark messageId seen
    // - emit internal CustomEvent with details
    function handleIncoming(raw) {
      if (!raw) return;
      // Defensive parsing: raw might be string or object
      let msg = raw;
      if (typeof raw === 'string') {
        try {
          msg = JSON.parse(raw);
        } catch (err) {
          // ignore malformed JSON
          return;
        }
      }
      if (!msg || !msg.messageId || !msg.matchId) return;
      if (msg.matchId !== matchId) return; // irrelevant
      // ignore blank payloads
      if (msg.payload === null || msg.payload === undefined) return;
      if (seen.has(msg.messageId)) return;
      // If the message came from this same tab/process, ignore to avoid loops.
      if (msg.originId && msg.originId === originId) return;
      if (typeof msg.version === 'number' && msg.version <= lastVersion) return;

      seen.add(msg.messageId);
      // persist a bounded list in sessionStorage
      try {
        const arr = Array.from(seen).slice(-200);
        sessionStorage.setItem(sessionKey, JSON.stringify(arr));
      } catch (e) {
        /* ignore storage errors */
      }
      if (typeof msg.version === 'number') lastVersion = Math.max(lastVersion, msg.version);

      // Dispatch internal in-page event so controller or display can react
      try {
        // Provide a normalized detail including originRole for listeners to check
        const detail = Object.assign({}, msg);
        window.dispatchEvent(new CustomEvent('ls:message', { detail }));
      } catch (err) {
        console.error('dispatchEvent failed', err);
      }
    }

    // Broadcast via BC or localStorage
    function broadcast(msg) {
      if (!msg || typeof msg !== 'object') throw new Error('invalid message');
      if (!msg.messageId) msg.messageId = Utils.uuid();
      msg.originId = originId;
      // mark the origin role for listeners
      msg.originRole = msg.originRole || role || 'display';
      msg.matchId = matchId;
      msg.ts = msg.ts || Utils.nowTs();

      // guard: ignore blank payloads
      if (msg.payload === null || msg.payload === undefined) {
        console.warn('Sync: ignoring blank payload');
        return;
      }

      const str = JSON.stringify(msg);

      // local delivery (same tab) - ensure in-page listeners receive event
      try {
        Promise.resolve().then(() => {
          window.dispatchEvent(new CustomEvent('ls:message', { detail: msg }));
        });
      } catch (err) {
        console.error('ls local dispatch failed', err);
      }

      // Use BroadcastChannel if available
      if (bc) {
        try {
          bc.postMessage(msg);
        } catch (err) {
          console.warn('BroadcastChannel post failed, falling back to localStorage', err);
        }
      }

      // Fallback: storage-event based broadcast
      try {
        // Use a stable key; set+remove to trigger storage events in other tabs
        const key = `${bcName}:message`;
        localStorage.setItem(key, str);
        localStorage.removeItem(key);
      } catch (err) {
        console.warn('localStorage broadcast failed', err);
      }
    }

    // Setup listeners
    if (bc) {
      bc.addEventListener('message', (ev) => {
        handleIncoming(ev.data);
      });
    }

    // storage event handler
    window.addEventListener('storage', (ev) => {
      try {
        if (!ev || !ev.key) return;
        const prefix = `${bcName}:message`;
        if (!ev.key.startsWith(prefix)) return;
        // Ev.newValue contains the stringified message (or null on remove)
        if (!ev.newValue) return;
        handleIncoming(ev.newValue);
      } catch (e) {
        console.error('storage handler error', e);
      }
    });

    // also listen for in-page custom events so modules can call window.addEventListener('ls:message')
    // No additional code needed: handleIncoming triggers that event when broadcasting locally.

    return { broadcast, create: () => create(matchId, role), _internal: { originId, role } };
  }

  return { create };
})(Utils);