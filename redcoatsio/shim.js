(function () {
  'use strict';

  console.log('[Redcoats Shim] Initializing client-side API mock & storage provider...');

  const STORAGE_PREFIX = 'redcoats_custom_';

  function getLocalItem(key, fallback) {
    try {
      const v = localStorage.getItem(STORAGE_PREFIX + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setLocalItem(key, val) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
    } catch (e) {
      console.warn('[Redcoats Shim] Failed to save localStorage:', e);
    }
  }

  let userMe = getLocalItem('me', null);
  if (!userMe || !userMe.id) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    userMe = {
      equipped: [],
      gold: 100.0,
      graphicsMode: 0,
      id: 'v2' + Math.random().toString(36).substring(2, 11),
      lastSeenAd: '1970-01-01T00:00:00.000000Z',
      level: 5.0,
      mIC: 0,
      now: new Date().toISOString(),
      selectedClass: 0,
      selectedSkin: null,
      username: 'Soldier_' + randomSuffix
    };
    setLocalItem('me', userMe);
  }

  const defaultConfig = {
    chatDisabled: false,
    crosshairRange: 100.0,
    crosshairType: 1,
    disableMouseAccel: true,
    graphicsMode: 2,
    horseViewTypeOffset: 0,
    instructionsOff: false,
    mouseSensitivity: 1.0,
    repeatKeys: false,
    scrollWeaponSwitch: false,
    scrollWeaponSwitchMode: 0,
    soundSwitch: true,
    soundVolume: 0.6,
    viewTypeOffset: 1
  };

  const defaultKeys = {
    aim: 'ShiftLeft',
    backwards: 'KeyS',
    chat: 'Enter',
    crouch: 'KeyC',
    forwards: 'KeyW',
    interact: 'KeyF',
    jump: 'Space',
    left: 'KeyA',
    repeat: 'KeyR',
    respawnStuck: 'KeyJ',
    right: 'KeyD',
    teamChat: 'KeyT',
    toggleMap: 'KeyM',
    toggleView: 'KeyV',
    weapon1: 'Digit1',
    weapon2: 'Digit2',
    weapon3: 'Digit3',
    weapon4: 'Digit4',
    weapon5: 'Digit5',
    weapon6: 'Digit6'
  };

  const WORKER_ORIGIN = 'https://homework-socket.hnhai.workers.dev';
  const WORKER_WS_ORIGIN = 'wss://homework-socket.hnhai.workers.dev';

  const activeServers = [1, 2, 3, 4].map((id, idx) => ({
    apiHost: `${WORKER_ORIGIN}/shipwrecked3d-game/server-${id}`,
    maxPlayerCount: 650,
    playerCount: id === 1 ? 120 : id === 2 ? 5 : 0,
    serverId: id,
    serverName: `Official Server ${id} (EU)`,
    version: 1,
    websocketHost: `${WORKER_WS_ORIGIN}/shipwrecked3d-game/server-${id}`
  }));

  const BLOCKED_SCRIPT_HOSTS = [
    'cdn.intergient.com',
    'api.adinplay.com',
    'googletagmanager.com',
    'google-analytics.com',
    'googlesyndication.com',
    'doubleclick.net',
    'accounts.google.com',
    'assets.msn.com',
    'sdk.crazygames.com',
    'game-cdn.poki.com'
  ];

  function isBlockedExternalUrl(rawUrl) {
    if (!rawUrl) return false;
    const str = String(rawUrl);
    return BLOCKED_SCRIPT_HOSTS.some(host => str.includes(host));
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.ramp = window.ramp || { que: [], passiveMode: true, addUnits: () => Promise.resolve(), displayUnits: () => {}, destroyUnits: () => Promise.resolve() };
  window.aiptag = window.aiptag || { cmd: { display: [], player: [] }, cmp: { show: () => {} } };

  function neutralizeBlockedScriptNode(node) {
    if (!node || node.nodeType !== 1 || node.tagName !== 'SCRIPT') return false;
    const rawSrc = node.getAttribute('src') || node.src || '';
    if (!isBlockedExternalUrl(rawSrc)) return false;
    node.removeAttribute('src');
    node.type = 'text/plain';
    node.dataset.blockedSrc = rawSrc;
    queueMicrotask(() => {
      try {
        if (typeof node.onload === 'function') node.onload(new Event('load'));
        node.dispatchEvent(new Event('load'));
      } catch {}
    });
    return true;
  }

  for (const protoMethod of [
    [Node.prototype, 'appendChild'],
    [Node.prototype, 'insertBefore'],
    [Element.prototype, 'append']
  ]) {
    const [proto, name] = protoMethod;
    const orig = proto && proto[name];
    if (typeof orig !== 'function') continue;
    proto[name] = function (...args) {
      for (const item of args) {
        if (item && item.nodeType === 1) neutralizeBlockedScriptNode(item);
      }
      return orig.apply(this, args);
    };
  }

  if (typeof window.WebSocket === 'function') {
    const NativeWebSocket = window.WebSocket;
    let consecutiveQuickFailures = 0;
    let lastNoticeAt = 0;
    const origConsoleLog = console.log.bind(console);
    console.log = function (...args) {
      if (consecutiveQuickFailures >= 4 && typeof args[0] === 'string' && args[0].includes('error socket not defined')) {
        return;
      }
      return origConsoleLog(...args);
    };

    const PatchedWebSocket = function (url, protocols) {
      const targetUrl = String(url || '');
      const ws = protocols !== undefined ? new NativeWebSocket(targetUrl, protocols) : new NativeWebSocket(targetUrl);
      const isGameSocket = targetUrl.includes('/shipwrecked3d-game/');
      if (!isGameSocket) return ws;

      const createdAt = Date.now();
      let openedOnce = false;
      ws.addEventListener('open', () => {
        openedOnce = true;
        consecutiveQuickFailures = 0;
      });
      ws.addEventListener('close', ev => {
        if (!openedOnce && Date.now() - createdAt < 2500) {
          consecutiveQuickFailures++;
          if (consecutiveQuickFailures >= 5 && Date.now() - lastNoticeAt > 15000) {
            lastNoticeAt = Date.now();
            console.warn('[Redcoats Shim] Game WebSocket unreachable on current network; slowing reconnect attempts.');
          }
        }
      });

      if (consecutiveQuickFailures >= 4) {
        const delay = Math.min(8000, 500 * Math.pow(2, Math.min(4, consecutiveQuickFailures - 4)));
        const origAddEventListener = ws.addEventListener.bind(ws);
        ws.addEventListener = function (type, listener, options) {
          if (type === 'close' && typeof listener === 'function') {
            return origAddEventListener(type, ev => {
              setTimeout(() => listener(ev), delay);
            }, options);
          }
          return origAddEventListener(type, listener, options);
        };
      }
      return ws;
    };
    PatchedWebSocket.prototype = NativeWebSocket.prototype;
    PatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    PatchedWebSocket.OPEN = NativeWebSocket.OPEN;
    PatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    PatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;
    window.WebSocket = PatchedWebSocket;
  }

  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    const method = (init && init.method ? init.method : 'GET').toUpperCase();

    if (urlStr.includes('/shipwrecked3d-game/api/')) {
      console.log('[Shim Intercepted Fetch]', method, urlStr);

      if (urlStr.includes('/api/list-servers')) {
        return new Response(JSON.stringify(activeServers), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (urlStr.includes('/api/time')) {
        return new Response(JSON.stringify({ time: new Date().toISOString() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (urlStr.includes('/api/me/config')) {
        if (method === 'PUT' && init && init.body) {
          try {
            const body = JSON.parse(init.body);
            setLocalItem('config', body);
            return new Response(JSON.stringify(body), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (e) {
            console.warn('[Redcoats Shim] Failed to parse config put:', e);
          }
        }
        const cfg = getLocalItem('config', defaultConfig);
        return new Response(JSON.stringify(cfg), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (urlStr.includes('/api/me/key-mapping')) {
        if (method === 'PUT' && init && init.body) {
          try {
            const body = JSON.parse(init.body);
            setLocalItem('key-mapping', body);
            return new Response(JSON.stringify(body), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (e) {
            console.warn('[Redcoats Shim] Failed to parse key-mapping put:', e);
          }
        }
        const km = getLocalItem('key-mapping', defaultKeys);
        return new Response(JSON.stringify(km), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (urlStr.includes('/api/me/flush')) {
        return new Response(JSON.stringify(userMe), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (urlStr.includes('/api/me/equip')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (urlStr.includes('/api/me/seen-ad')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (urlStr.includes('/api/me')) {
        if (method === 'PATCH' && init && init.body) {
          try {
            const patch = JSON.parse(init.body);
            Object.assign(userMe, patch);
            setLocalItem('me', userMe);
          } catch (e) {
            console.warn('[Redcoats Shim] Failed to patch me:', e);
          }
        }
        return new Response(JSON.stringify(userMe), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (urlStr.includes('/api/error') || urlStr.includes('/api/sign')) {
        return new Response(JSON.stringify({ success: true, user: userMe }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (isBlockedExternalUrl(urlStr)) {
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      });
    }

    return originalFetch.apply(this, arguments);
  };

  console.log('[Redcoats Shim] Ready.');
})();
