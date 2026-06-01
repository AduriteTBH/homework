(function (HR) {
  var myNameIdx = Math.floor(Math.random() * HR.CALLSIGNS.length);
  var myName = HR.CALLSIGNS[myNameIdx];
  var myId = null;
  var mode = 'menu';
  var gameState = HR.createInitialState();
  var net = null;
  var renderer = null;
  var hostInterval = null;
  var gameOverShown = false;

  var canvas = document.getElementById('gameCanvas');
  var minimapCanvas = document.getElementById('minimapCanvas');

  HR.getMyPos = function () {
    var p = gameState.players && gameState.players[myId];
    return p ? { x: p.x, y: p.y } : null;
  };

  function init() {
    renderer = HR.createRenderer(canvas, minimapCanvas);
    HR.initInput(canvas);
    HR.setPlayerName(myName);
    var callsignLbl = document.getElementById('callsign-label');
    if(callsignLbl) callsignLbl.textContent = myName;

    net = new HR.NetworkManager({
      getName: function () { return HR.myCallsign || myName; },
      getLobbyPlayers: function () { return gameState.players; },
      onPlayerJoin: function (peerId, name) {
        gameState.players[peerId] = HR.createPlayer(peerId, name, false);
        gameState.players[peerId].isHost = false;
        HR.updateLobbyList(gameState.players);
      },
      onPlayerLeave: function (peerId) {
        delete gameState.players[peerId];
        HR.updateLobbyList(gameState.players);
        if (!gameState.started) {
          net.broadcast({ type: 'LOBBY_UPDATE', players: gameState.players });
        }
      },
      onPlayerInput: function (peerId, input) {
        if (gameState.players[peerId]) {
          gameState.players[peerId].input = input;
        }
      },
      onJoinAck: function (data) {
        gameState.players = data.players;
        myId = data.peerId;
        HR.updateLobbyList(gameState.players);
        HR.setLobbyStatus('Connected! Waiting for host to launch…');
      },
      onLobbyUpdate: function (players) {
        gameState.players = players;
        HR.updateLobbyList(players);
      },
      onStartGame: function (state, youAre) {
        myId = youAre || myId;
        HR.simulateLoading([
          { text: 'Receiving map data...', delay: 500 },
          { text: 'Synchronizing with host...', delay: 600 },
          { text: 'Match starting!', delay: 400 }
        ], function() {
          beginMatch(state);
        });
      },
      onStateUpdate: function (state) {
        applyRemoteState(state);
      },
      onEvent: function (data) {
        if (data.kind === 'explosion') {
          HR.spawnParticles(data.x, data.y, data.color);
        } else if (data.kind === 'killfeed') {
          gameState.killFeed = data.killFeed;
          HR.updateKillFeed(gameState.killFeed);
        }
      },
      onHostDisconnected: function () {
        alert('Host disconnected.');
        location.reload();
      },
      onGameOver: function (winner) {
        if (winner) {
          gameState.winner = gameState.players[winner.id] || winner;
          gameState.started = false;
        }
      },
    });

    HR.bindMenuHandlers({
      onCycleName: function (dir, cb) {
        myNameIdx = (myNameIdx + dir + HR.CALLSIGNS.length) % HR.CALLSIGNS.length;
        myName = HR.CALLSIGNS[myNameIdx];
        HR.setPlayerName(myName);
        if(cb) cb(myName);
      },
      onCreate: createHostGame,
      onJoin: joinGame,
      onSolo: startSoloGame,
      onStart: launchMatch,
      onCopyCode: function () {
        HR.copyRoomCode(net ? net.roomCode : '');
      },
    });

    if (window.HR_ENV && HR_ENV.applyMenuMode) {
      HR_ENV.applyMenuMode();
    }

    document.body.classList.add('at-menu');
    var menuScreen = document.getElementById('menu-screen');
    if (menuScreen) {
      requestAnimationFrame(function () {
        menuScreen.classList.add('screen-enter');
        document.body.classList.add('menu-intro-done');
      });
    }

    var fileHint = document.getElementById('file-mode-hint');
    if (window.HR_ENV && HR_ENV.isFile) {
      if (fileHint) fileHint.classList.remove('hidden');
      var btnHost = document.querySelector('[data-action="host"]');
      var btnJoin = document.querySelector('[data-action="join"]');
      if (btnHost) { btnHost.disabled = true; btnHost.style.opacity = '0.3'; btnHost.style.cursor = 'not-allowed'; btnHost.title = 'Not available in file mode'; }
      if (btnJoin) { btnJoin.disabled = true; btnJoin.style.opacity = '0.3'; btnJoin.style.cursor = 'not-allowed'; btnJoin.title = 'Not available in file mode'; }
    }
  }

  function createHostGame() {
    if (window.HR_ENV && !HR_ENV.guardMultiplayer()) return;
    document.getElementById('join-panel').classList.add('panel-closed');

    HR.setMenuStatus('Creating room…', false);
    gameState = HR.createInitialState();
    mode = 'host';

    net.createRoom(HR.setMenuStatus).then(function (code) {
      myId = net.myPeerId;
      myName = HR.myCallsign || myName;
      gameState.players[myId] = HR.createPlayer(myId, myName, false);
      gameState.players[myId].isHost = true;

      HR.showScreen('lobby');
      HR.setRoomCode(code);
      HR.toggleHostStart(true);
      HR.setLobbyStatus('Share the code. Friends on any device can join before you launch.');
      HR.updateLobbyList(gameState.players);
      HR.setMenuStatus('');
    }).catch(function (err) {
      HR.setMenuStatus(err.message || 'Failed to create room.');
    });
  }

  function joinGame() {
    if (window.HR_ENV && !HR_ENV.guardMultiplayer()) return;

    var input = document.getElementById('join-code-input');
    var code = (input && input.value ? input.value : '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== HR.CONFIG.ROOM_CODE_LEN) {
      HR.setMenuStatus('Enter a valid 5-character room code.');
      return;
    }

    HR.setMenuStatus('Joining…', false);
    gameState = HR.createInitialState();
    mode = 'client';

    net.joinRoom(code, HR.setMenuStatus).then(function (joined) {
      HR.showScreen('lobby');
      HR.setRoomCode(joined);
      HR.toggleHostStart(false);
      HR.setMenuStatus('');
    }).catch(function (err) {
      HR.setMenuStatus(err.message || 'Could not join room.');
    });
  }

  function startSoloGame() {
    mode = 'solo';
    HR.simulateLoading([
      { text: 'Establishing secure link...', delay: 500 },
      { text: 'Connecting to dedicated server...', delay: 400 },
      { text: 'Waiting for players (1/30)...', delay: 700 },
      { text: 'Waiting for players (10/30)...', delay: 300 },
      { text: 'Waiting for players (22/30)...', delay: 500 },
      { text: 'Waiting for players (30/30)...', delay: 200 },
      { text: 'Match starting!', delay: 400 }
    ], function() {
      gameState = HR.createInitialState();
      myId = 'SOLO_' + Date.now();
      myName = HR.myCallsign || myName;
      gameState.players[myId] = HR.createPlayer(myId, myName, false);

      HR.fillWithBots(gameState, HR.CONFIG.MAX_PLAYERS - 1);
      HR.spawnCrates(gameState);
      gameState.started = true;
      gameState.matchStartTime = Date.now() + 3000;
      HR.countAlive(gameState);

      HR.showScreen('game');
      beginMatch(gameState, true);
    });
  }

  function launchMatch() {
    if (mode !== 'host') return;

    HR.simulateLoading([
      { text: 'Locking lobby...', delay: 500 },
      { text: 'Synchronizing clients...', delay: 600 },
      { text: 'Generating map data...', delay: 700 },
      { text: 'Match starting!', delay: 400 }
    ], function() {
      var botInput = document.getElementById('bot-count-input');
      var targetBots = botInput ? parseInt(botInput.value, 10) : (HR.CONFIG.MAX_PLAYERS - 1);
      if (isNaN(targetBots)) targetBots = HR.CONFIG.MAX_PLAYERS - 1;
      
      if (HR.CONFIG.BOT_FILL && targetBots > 0) {
        HR.fillWithBots(gameState, Math.max(0, targetBots));
      }

      HR.spawnCrates(gameState);
      gameState.started = true;
      gameState.matchStartTime = Date.now() + 3000;
      HR.countAlive(gameState);

      net.startGameForAll(sanitizeStateForNetwork(gameState));
      beginMatch(gameState, true);
    });
  }

  function beginMatch(state, isLocalHost) {
    gameState = state;
    if (!myId && net && net.myPeerId) myId = net.myPeerId;

    gameOverShown = false;
    HR.showScreen('game');
    if (HR.initGameHud) HR.initGameHud();
    renderer.syncPlayers(gameState.players, myId);

    if (isLocalHost || mode === 'host' || mode === 'solo') {
      if (hostInterval) clearInterval(hostInterval);
      hostInterval = setInterval(hostTick, 1000 / HR.CONFIG.TICK_RATE);
    }
    
    requestAnimationFrame(renderLoop);
  }

  function hostTick() {
    if (!gameState.started) return;

    if (gameState.matchStartTime && Date.now() < gameState.matchStartTime) {
      if (mode === 'host') net.broadcastState(sanitizeStateForNetwork(gameState));
      applyRemoteState(gameState);
      return;
    }

    var localPlayer = gameState.players[myId];
    if (localPlayer && localPlayer.alive) {
      localPlayer.input = HR.getInputSnapshot(canvas);
    }

    Object.values(gameState.players).forEach(function (p) {
      if (!p.alive) return;
      if (p.fireCooldown > 0) p.fireCooldown--;

      var isLocal = p.id === myId;

      if (p.isBot) HR.runBotAI(p, gameState);

      if (HR.tryDash(p, isLocal)) {
        if (isLocal && HR.addScreenShake) HR.addScreenShake(6);
      }

      HR.applyMovement(p);
      HR.tryShoot(gameState, p, isLocal);
      HR.collectGems(gameState, p, null, isLocal);
      HR.applyStormDamage(gameState, p);

      if (p.hp <= 0 && p.alive) {
        p.alive = false;
        HR.pushKillFeed(gameState, p, null);
        broadcastEvent({ kind: 'explosion', x: p.x, y: p.y, color: p.color });
        broadcastEvent({ kind: 'killfeed', killFeed: gameState.killFeed });
        if (p.id === myId) HR.stats.addGame();
      }
    });

    HR.updateBullets(
      gameState,
      function (x, y, color) { broadcastEvent({ kind: 'explosion', x: x, y: y, color: color }); },
      function (victim, killer) {
        HR.pushKillFeed(gameState, victim, killer);
        broadcastEvent({ kind: 'killfeed', killFeed: gameState.killFeed });
        if (killer && killer.id === myId) HR.stats.addKill();
      }
    );

    HR.updateStorm(gameState);
    HR.countAlive(gameState);

    var winner = HR.checkWinner(gameState);
    if (winner) {
      gameState.started = false;
      if (winner.id === myId) {
        HR.stats.addWin();
      } else {
        var p = gameState.players[myId];
        if (p && p.alive) HR.stats.addGame(); // If you survived but it ended
      }
      if (hostInterval) clearInterval(hostInterval);
      if (mode === 'host') {
        net.broadcast({ type: 'GAME_OVER', winner: { id: winner.id, name: winner.name } });
      }
    }

    if (mode === 'host') {
      net.broadcastState(sanitizeStateForNetwork(gameState));
    }

    applyRemoteState(gameState);
  }

  function applyRemoteState(state) {
    gameState.bullets = state.bullets;
    gameState.crates = state.crates;
    gameState.gems = state.gems;
    gameState.storm = state.storm;
    gameState.aliveCount = state.aliveCount;
    gameState.killFeed = state.killFeed || gameState.killFeed;
    gameState.winner = state.winner;
    gameState.matchStartTime = state.matchStartTime;

    Object.values(state.players).forEach(function (p) {
      if (!gameState.players[p.id]) {
        gameState.players[p.id] = Object.assign({}, p);
      } else {
        Object.assign(gameState.players[p.id], p);
      }
    });

    renderer.syncPlayers(gameState.players, myId);
    HR.updateKillFeed(gameState.killFeed);
  }

  function broadcastEvent(event) {
    if (event.kind === 'explosion') {
      HR.spawnParticles(event.x, event.y, event.color);
      if (HR.audio) HR.audio.explode(event.x, event.y);
    } else if (event.kind === 'killfeed') {
      gameState.killFeed = event.killFeed;
      HR.updateKillFeed(event.killFeed);
    }
    if (mode === 'host') {
      net.broadcastEvent(event);
    }
  }

  function sanitizeStateForNetwork(state) {
    var copy = JSON.parse(JSON.stringify(state));
    Object.values(copy.players).forEach(function (p) {
      delete p.input;
    });
    return copy;
  }

  HR.simulateLoading = function(steps, onComplete) {
    if (HR.showScreen) HR.showScreen('loading');
    
    var text = document.getElementById('loading-text');
    var tip = document.getElementById('loading-tip');
    
    if (tip) {
      var tips = [
        "TIP: Dash [Q] to dodge incoming fire and maneuver quickly.",
        "TIP: Collect gems from destroyed enemies to level up your hopter.",
        "TIP: Stay inside the safe zone! The storm will damage you.",
        "TIP: Crates contain valuable XP. Shoot them open!",
        "TIP: Win 3 multiplayer games to unlock custom callsigns!"
      ];
      tip.textContent = tips[Math.floor(Math.random() * tips.length)];
    }

    var i = 0;
    function next() {
      if (i >= steps.length) {
        onComplete();
        return;
      }
      if (text) text.textContent = steps[i].text;
      if (HR.audio) {
        if (HR.audio.loadingTick) HR.audio.loadingTick(i);
        else HR.audio.ui();
      }
      setTimeout(next, steps[i].delay);
      i++;
    }
    next();
  };

  HR.restartMatch = function() {
    if (mode === 'solo') {
      startSoloGame();
    } else {
      location.reload();
    }
  };

  var lastInputTime = 0;
  var lastFrame = Date.now();
  var rotorPhase = 0;
  function renderLoop() {
    if (!gameState.started && !gameState.winner) {
      requestAnimationFrame(renderLoop);
      return;
    }

    if (mode === 'client' && gameState.started) {
      var snap = HR.getInputSnapshot(canvas);
      var now = Date.now();
      if (snap.dash || snap.click !== (HR.lastSentInput||{}).click || now - lastInputTime > 40) {
        net.sendInput(snap);
        HR.lastSentInput = snap;
        lastInputTime = now;
      }
    }

    var now = Date.now();
    var dt = (now - lastFrame) / 1000;
    lastFrame = now;
    rotorPhase += 0.45 * dt;

    HR.fpsFrames = (HR.fpsFrames || 0) + 1;
    if (!HR.fpsTime) HR.fpsTime = now;
    if (now - HR.fpsTime >= 1000) {
      var avgFps = HR.fpsFrames / ((now - HR.fpsTime) / 1000);
      var fpsEl = document.getElementById('fps-counter');
      if (fpsEl) fpsEl.textContent = Math.round(avgFps) + ' FPS';

      if (avgFps < 40 && !HR.RUNTIME_LOW_GRAPHICS) {
        HR.RUNTIME_LOW_GRAPHICS = true;
      } else if (avgFps > 50 && HR.RUNTIME_LOW_GRAPHICS) {
        HR.RUNTIME_LOW_GRAPHICS = false;
      }
      HR.fpsFrames = 0;
      HR.fpsTime = now;
    }

    var me = renderer.render(gameState, myId);
    if (me) {
      HR.updateHud(gameState, me);

      if (!gameOverShown && (!me.alive || gameState.winner)) {
        gameOverShown = true;
        HR.showGameOver(gameState.winner, me);
      }
    }

    requestAnimationFrame(renderLoop);
  }

  init();
})(window.HR);
