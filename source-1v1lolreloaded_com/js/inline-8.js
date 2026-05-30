
    initializeFireBase();
    initRemoteConfig();
    // Expose unityInstance when Unity becomes ready — for SendMessage
    window.addEventListener('load', function() {
      var check = setInterval(function() {
        if (typeof gameInstance !== 'undefined' && gameInstance) {
          window.unityInstance = gameInstance;
          clearInterval(check);
        }
      }, 100);
    });
    // Dev helper: force-trigger BattlePassNewSeasonPopup via SendMessage. The popup
    // GameObject lives at OverlayCanvas/Popups/SafeContent/BattlePassNewSeasonPopup
    // (active=true) but its show-method only fires when the canonical subscribe-chain
    // sees a fresh-season FirebaseBattlePassData event and PlayerPrefs.BPSeasonNPopupShown
    // is unset. Use this to confirm GameObject reachable and identify which obfuscated
    // method opens the panel.
    window.forceBPPopup = function() {
      if (!window.unityInstance) { console.warn('Unity not ready'); return; }
      var SM = window.unityInstance.SendMessage.bind(window.unityInstance);
      // Candidate show methods on BPNewSeasonPopup (from script.json):
      //   POOBPEGKNDC  CMAPMFBOOIG(bool)  NOIIPIHGKFK  PEIKGICHKJO  HCOBGGJCOHF
      var methods = ['POOBPEGKNDC','NOIIPIHGKFK','PEIKGICHKJO','HCOBGGJCOHF'];
      methods.forEach(function(m) {
        try { SM('BattlePassNewSeasonPopup', m); console.log('Sent →', m); }
        catch(e) { console.warn('SM err', m, e.message); }
      });
      // CMAPMFBOOIG takes a bool — try with 1
      try { SM('BattlePassNewSeasonPopup', 'CMAPMFBOOIG', 1); console.log('Sent → CMAPMFBOOIG(1)'); } catch(e) {}
    };

    // Daily Rewards force-trigger. DailyRewardsManager lives on a child of PersistantObjects.
    // Methods (parameterless, sig vii): HLJOKNPKPHF (a=13914) and MKIDDFIOFMD (a=13913) —
    // likely "ShowPopupIfNeeded" or "RefreshDisplay". The popup GameObject (path_id=7629)
    // is inactive by default and gets activated by manager when data + conditions check out.
    // Manager.Start does the auto-popup gate ONCE at scene init — if RC data not yet
    // available, the popup is silently skipped (race with FirebaseDailyRewardsData event).
    // Direct test of /api/firebase/lootBox/openLootBox endpoint, bypassing UI button click.
    // Useful when UI click handler isn't firing — confirms server side works.
    // Usage: forceOpenLootBox()         opens RLB1 (500 LC box)
    //        forceOpenLootBox('RLB2')   opens RLB2 (1500 LC box)
    // Diagnostic — POSTs to /api/firebase/lootBox/openLootBox directly to verify server
    // side works. Used only to confirm endpoint chain, NOT a UX replacement for native UI.
    window.forceOpenLootBox = function(which) {
      var sku = 'lol.1v1.lootbox.' + (which || 'RLB1');
      var token = localStorage.getItem('1v1_session_token') || 'local-token';
      fetch('/api/firebase/lootBox/openLootBox', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'lootBoxId=' + encodeURIComponent(sku)
      }).then(function(r) { return r.json().then(function(j){ return {status: r.status, body: j}; }); })
        .then(function(res) { console.log('[LootBox] →', res.status, res.body); })
        .catch(function(e) { console.warn('[LootBox] err:', e.message); });
    };

    // Test what LootBox-related Unity methods exist & fire when clicked.
    window.forceLootBoxClick = function() {
      if (!window.unityInstance) { console.warn('Unity not ready'); return; }
      var SM = window.unityInstance.SendMessage.bind(window.unityInstance);
      // Try GO names + parameterless methods (sig vii).
      // Pass SKU as string param for sig viii methods (PJMEJHLCPLK is parameterless).
      var targets = ['LootBox','LootBoxBuyAction','LootBoxMenuItem','MenuLootBoxes','LootBoxImage','LootBoxOpenManager','MainMenuManagers'];
      var pmethods = ['OnLootBoxClicked','PJMEJHLCPLK','OpenLootBox','GoToOpenLootBoxScreen','OnScreenPressed','MONADFDAIDJ','MLIMCJFEAOO','PNIEIPLBIGC'];
      targets.forEach(function(go) {
        pmethods.forEach(function(m) {
          try { SM(go, m); console.log('Sent → ' + go + '.' + m); }
          catch(e) {}
        });
      });
      // Buy(string) — pass SKU
      try { SM('LootBoxBuyAction', 'Buy', 'lol.1v1.lootbox.RLB1'); console.log('Sent → LootBoxBuyAction.Buy(RLB1)'); }
      catch(e) {}
    };

    window.forceDailyPopup = function() {
      if (!window.unityInstance) { console.warn('Unity not ready'); return; }
      var SM = window.unityInstance.SendMessage.bind(window.unityInstance);
      // Try several GO names since manager hierarchy isn't fully traced.
      var targets = ['DailyRewardsManager','PersistantObjects','MainMenuManagers','DailyRewardsButton'];
      var methods = ['MKIDDFIOFMD','HLJOKNPKPHF','DOFPAMABHDA','NNHLHMKELNC','IBHFKCEGMLH'];
      targets.forEach(function(go) {
        methods.forEach(function(m) {
          try { SM(go, m); console.log('Sent → ' + go + '.' + m); }
          catch(e) {}
        });
      });
    };
    // Stubs for Unity → JS bridge
    window.updateFullscreen = function() {
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          return;
        }
        // Target the .webgl-content wrapper (NOT <html>) so our :fullscreen CSS
        // can drop the 1280px/16:9 cap and fill the actual screen.
        var el = document.querySelector('.webgl-content');
        if (!el) return;
        var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (req) req.call(el).catch(function(){});
      } catch(e) {}
    };

    // Fullscreen toggle icon, anchored inside the game frame (top-right of .webgl-content).
    // Lets players re-enter fullscreen after ESC kicked them out mid-match without digging
    // for Unity's in-game button.
    (function() {
      var _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (_isIOS) return;
      var container = document.querySelector('.webgl-content');
      if (!container) return;
      var btn = document.createElement('button');
      btn.setAttribute('aria-label', 'Toggle fullscreen');
      btn.title = 'Toggle fullscreen';
      btn.style.cssText = 'position:absolute;top:10px;right:10px;width:36px;height:36px;padding:0;z-index:99999;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.15);border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.55;transition:opacity 0.2s,transform 0.2s;';
      btn.onmouseenter = function() { btn.style.opacity = '1'; btn.style.transform = 'scale(1.05)'; };
      btn.onmouseleave = function() { btn.style.opacity = '0.55'; btn.style.transform = 'scale(1)'; };
      var iconEnter = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4"/></svg>';
      var iconExit = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v4a1 1 0 0 1-1 1H3M16 3v4a1 1 0 0 0 1 1h4M8 21v-4a1 1 0 0 0-1-1H3M16 21v-4a1 1 0 0 1 1-1h4"/></svg>';
      var updateIcon = function() { btn.innerHTML = (document.fullscreenElement || document.webkitFullscreenElement) ? iconExit : iconEnter; };
      btn.onclick = function(e) { e.preventDefault(); window.updateFullscreen(); };
      document.addEventListener('fullscreenchange', updateIcon);
      document.addEventListener('webkitfullscreenchange', updateIcon);
      updateIcon();
      container.appendChild(btn);
    })();

    // "Powered by" banner — only inside iframe on external sites
    (function() {
      if (window.parent === window) return;
      var isExternal = false;
      try { isExternal = window.parent.location.hostname !== window.location.hostname; } catch(e) { isExternal = true; }
      if (!isExternal) return;

      var b = document.createElement('a');
      b.href = 'https://1v1lolreloaded.com';
      b.target = '_blank';
      b.rel = 'noopener';
      b.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99999;display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);border-radius:8px;text-decoration:none;font-family:\'Dimbo\',Impact,Arial,sans-serif;transition:opacity 0.3s,transform 0.3s;opacity:0.7;';
      b.onmouseenter = function(){ b.style.opacity='1'; b.style.transform='scale(1.03)'; };
      b.onmouseleave = function(){ b.style.opacity='0.7'; b.style.transform='scale(1)'; };

      var icon = document.createElement('span');
      icon.style.cssText = 'width:22px;height:22px;border-radius:4px;background:linear-gradient(135deg,#6366f1,#00d4ff);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:normal;color:#fff;font-family:\'Dimbo\',Impact,Arial,sans-serif;letter-spacing:0.5px;line-height:1;';
      icon.innerHTML = '1<span style="color:#ef4444;">v</span>1';
      b.appendChild(icon);

      var txt = document.createElement('span');
      txt.style.cssText = 'font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);letter-spacing:0.5px;line-height:1;font-family:\'Blinker\',system-ui,sans-serif;';
      txt.innerHTML = 'Powered by <span style="color:#fff;">1<span style="color:#ef4444;">v</span>1.LOL</span> <span style="background:linear-gradient(135deg,#ff8c42,#8ad0ff,#ff6b35,#ff8c42);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">RELOADED</span>';
      b.appendChild(txt);

      document.body.appendChild(b);
    })();

    window.showAds = function() { console.log('show ads (mocked)'); };
    window.requestNewAd = function() { if (window.unityAdFinishedCallback) window.unityAdFinishedCallback(); };
    // In 4.23 ad-callback target is PersistantObjects.OnWebCallback — AdsManager MonoBehaviour
    // is attached to PersistantObjects GameObject (verified via UnityPy bundle inspection 2026-05-20).
    // Canonical signature: `void AdsManager.OnWebCallback(string OEDHKFOLJGI)` (dump.cs:484737).
    // Internal: parses arg via `System.Boolean.Parse` — accepted values "true" / "false" only.
    // First test with empty arg raised `FormatException: String was not recognized as a valid Boolean`.
    // We send "true" to signal "ad watched successfully, deliver reward" so the post-match /
    // rewarded video flow completes and match start unblocks on first Play click.
    window.unityAdFinishedCallback = function() {
      if (!window.unityInstance) return;
      var targets = [
        ['PersistantObjects', 'OnWebCallback', 'true'],     // 4.23 canonical AdsManager target
        ['WebCallbacks', 'RvWatchComplete', 'true'],
        ['PersistantObjects', 'RvWatchComplete', 'true']
      ];
      targets.forEach(function(t) {
        try {
          window.unityInstance.SendMessage(t[0], t[1], t[2]);
        } catch(e){}
      });
    };
    // Signal ad is ready (some flows wait for this before advancing)
    window.unityAdReadyCallback = function() {
      if (!window.unityInstance) return;
      try { window.unityInstance.SendMessage('WebCallbacks', 'RvReady'); } catch(e){}
      try { window.unityInstance.SendMessage('PersistantObjects', 'RvReady'); } catch(e){}
    };
    window.onUnityReady = function() {
      console.log('[TestInit] Unity ready, broadcasting config to multiple receivers...');
      // Wait for Remote Config to be ready, then broadcast to multiple likely targets.
      // 4.23 build (Apr 2022): introduced PlayersManager class. RC targets may differ.
      var tries = 0;
      var sendAll = function() {
        tries++;
        if (typeof conf === 'undefined' || !conf) {
          if (tries < 60) { setTimeout(sendAll, 200); return; }
          console.error('[TestInit] conf never resolved'); return;
        }
        if (!window.unityInstance) {
          if (tries < 60) { setTimeout(sendAll, 200); return; }
          console.error('[TestInit] unityInstance never appeared'); return;
        }
        var configJson = JSON.stringify(conf);

        // 4.23 canonical RC delivery (runtime-confirmed 2026-05-18):
        //
        // In production, Firebase Unity SDK fetches RC asynchronously and calls
        // SendMessage('PersistantObjects', 'ActivateRemoteConfig', json) once
        // FirebaseConfigHandler.OKEBMIHOHGN() has instantiated all 9 typed
        // handlers (PIAOCGLOAOD, GPLAFHNMEBI, etc. derived from ODEAJABHDAB<T>)
        // and added them to MNEJFEPFGFO (List<KKPBOGIENOH>). Wasm grep confirms
        // ActivateRemoteConfig has ZERO internal callers — it is the SDK's
        // external entry point; SendMessage is the canonical way to invoke it.
        //
        // The natural Firebase fetch latency (hundreds of ms) is what normally
        // ensures handlers are ready before dispatch. We mock the SDK by waiting
        // on the same precondition: poll FirebaseConfigHandler._TypeInfo
        // (@ 7000672) → staticFields(.+92) → MNEJFEPFGFO(.+0x10) → List._size
        // until == 9 (one per RC group). Then SendMessage once with the payload.
        //
        // Receiver: PersistantObjects (verified — FirebaseConfigHandler is a
        // MonoBehaviour component on this persistent root, see _kb/02_scene/
        // persistent_singletons.json).
        var probeCount = 0;
        var deliverRC = function() {
          probeCount++;
          try {
            var u = window.unityInstance;
            if (!u || !u.Module) { setTimeout(deliverRC, 200); return; }
            var HEAPU32 = u.Module.HEAPU32;
            var cls = HEAPU32[7000672 >> 2];                  // FirebaseConfigHandler_TypeInfo
            if (!cls) { setTimeout(deliverRC, 200); return; }
            var sf = HEAPU32[(cls + 92) >> 2];                // → static fields
            if (!sf) { setTimeout(deliverRC, 200); return; }
            var listPtr = HEAPU32[(sf + 0x10) >> 2];          // MNEJFEPFGFO
            var size = listPtr ? (HEAPU32[(listPtr + 0xC) >> 2] | 0) : 0;
            if (size >= 9) {
              console.log('[TestInit] RC delivery: 9 handlers registered (after ' + probeCount + ' probes, ~' + (probeCount * 200) + 'ms). Sending ActivateRemoteConfig.');
              u.SendMessage('PersistantObjects', 'ActivateRemoteConfig', configJson);
              return;
            }
            if (probeCount < 100) { setTimeout(deliverRC, 200); return; }
            console.warn('[TestInit] RC delivery: gave up — only ' + size + ' handlers after ' + probeCount + ' probes');
          } catch (e) {
            console.warn('[TestInit] RC delivery poll error:', e.message);
            if (probeCount < 100) setTimeout(deliverRC, 200);
          }
        };
        setTimeout(deliverRC, 200);

        // Auto-select default mode so Play button works on first click.
        // In 4.17 GameModesHandler._lastMode is null until user explicitly picks a mode;
        // OnPlayPressed() silently exits when _lastMode==null. PlayerPrefs key "LastUsedMode"
        // would persist it across sessions, but is empty in fresh/incognito. Broadcast
        // OnGameModeChanged to all plausible GameObjects to prime the selection.
        setTimeout(function() {
          var modeTargets = [
            ['PersistantObjects', 'OnGameModeChanged'],
            ['Connector', 'OnGameModeChanged'],
            ['PartyRoomConnector', 'OnGameModeChanged'],
            ['GameModesHandler', 'OnGameModeChanged'],
            ['MainMenuManagers', 'OnGameModeChanged'],
            ['AppManager', 'OnGameModeChanged'],
            ['PersistantObjects', 'SetMode'],
            ['MainMenuManagers', 'SetMode']
          ];
          modeTargets.forEach(function(t) {
            try { window.unityInstance.SendMessage(t[0], t[1], '1v1'); } catch(e){}
          });
          console.log('[TestInit] default mode primed to 1v1');
        }, 3000);

        // 4.23 fix (_kb/06_init investigation):
        // NetworkManager.OnConnected fires ONCE on initial NS WS connect, sets PHFDMKLKGPB=true.
        // PUN ns→master transition fires OnDisconnected with DisconnectByClientLogic →
        // PHFDMKLKGPB silently flipped to false (no event raised). PUN then fires
        // OnConnectedToMaster (NOT OnConnected), which NetworkManager doesn't override.
        // Net result: PHFDMKLKGPB stays false → JEMCPBLELPH (IsOnline) stays false →
        // ModeMenuManager.OnEnable sees offline → tabs render _offlineModeUis fallback.
        // Fix: manually invoke NetworkManager.OnConnected after master connect settles.
        // Re-entering the branch with PHFDMKLKGPB=false re-fires OJKCDBCFCMO(true),
        // setting PHFDMKLKGPB=true → JEMCPBLELPH=true → modes tabs populate from RC.
        // 4.23 NetworkManager listens to OnConnected (and not OnConnectedToMaster), but try both
        // just in case. PUN MonoBehaviourPunCallbacks has OnConnectedToMaster also virtual.
        // Each call is no-op if state already correct, so safe to repeat.
        [1000, 3000, 5000, 8000, 12000].forEach(function(delay) {
          setTimeout(function() {
            try { window.unityInstance.SendMessage('PersistantObjects', 'OnConnected'); } catch(e){}
            try { window.unityInstance.SendMessage('PersistantObjects', 'OnConnectedToMaster'); } catch(e){}
            try { window.unityInstance.SendMessage('PersistantObjects', 'OnJoinedLobby'); } catch(e){}
          }, delay);
        });
        console.log('[TestInit] scheduled NetworkManager.OnConnected/OnConnectedToMaster/OnJoinedLobby at 1s/3s/5s/8s/12s');
        // Periodic refresh in case state desyncs (party leave / network blip).
        setInterval(function() {
          if (!window._inGameScene) {
            try { window.unityInstance.SendMessage('PersistantObjects', 'OnConnected'); } catch(e){}
          }
        }, 30000);
      };
      sendAll();
    };
  