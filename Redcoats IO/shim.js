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

  const activeServers = [
    {
      apiHost: 'https://homework-socket.hnhai.workers.dev/shipwrecked3d-game/server-1',
      maxPlayerCount: 650,
      playerCount: 120,
      serverId: 1,
      serverName: 'Official Server 1 (EU)',
      version: 1,
      websocketHost: 'wss://homework-socket.hnhai.workers.dev/shipwrecked3d-game/server-1'
    },
    {
      apiHost: 'https://homework-socket.hnhai.workers.dev/shipwrecked3d-game/server-2',
      maxPlayerCount: 650,
      playerCount: 5,
      serverId: 2,
      serverName: 'Official Server 2 (EU)',
      version: 1,
      websocketHost: 'wss://homework-socket.hnhai.workers.dev/shipwrecked3d-game/server-2'
    },
    {
      apiHost: 'https://homework-socket.hnhai.workers.dev/shipwrecked3d-game/server-3',
      maxPlayerCount: 650,
      playerCount: 0,
      serverId: 3,
      serverName: 'Official Server 3 (EU)',
      version: 1,
      websocketHost: 'wss://homework-socket.hnhai.workers.dev/shipwrecked3d-game/server-3'
    },
    {
      apiHost: 'https://homework-socket.hnhai.workers.dev/shipwrecked3d-game/server-4',
      maxPlayerCount: 650,
      playerCount: 0,
      serverId: 4,
      serverName: 'Official Server 4 (EU)',
      version: 1,
      websocketHost: 'wss://homework-socket.hnhai.workers.dev/shipwrecked3d-game/server-4'
    }
  ];

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

      if (urlStr.includes('/api/error')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return originalFetch.apply(this, arguments);
  };

  console.log('[Redcoats Shim] Ready.');
})();
