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
      getName: function () { return myName; },
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
        beginMatch(state);
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
    if (fileHint && window.HR_ENV && HR_ENV.isFile) {
      fileHint.classList.remove('hidden');
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
    gameState = HR.createInitialState();
    myId = 'SOLO_' + Date.now();
    gameState.players[myId] = HR.createPlayer(myId, myName, false);

    HR.fillWithBots(gameState, HR.CONFIG.MAX_PLAYERS - 1);
    HR.spawnCrates(gameState);
    gameState.started = true;
    HR.countAlive(gameState);

    HR.showScreen('game');
    beginMatch(gameState, true);
  }

  function launchMatch() {
    if (mode !== 'host') return;

    var humanCount = Object.keys(gameState.players).length;
    if (HR.CONFIG.BOT_FILL) {
      HR.fillWithBots(gameState, Math.max(0, HR.CONFIG.MAX_PLAYERS - humanCount));
    }

    HR.spawnCrates(gameState);
    gameState.started = true;
    HR.countAlive(gameState);

    net.startGameForAll(sanitizeStateForNetwork(gameState));
    beginMatch(gameState, true);
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
      }
    });

    HR.updateBullets(
      gameState,
      function (x, y, color) { broadcastEvent({ kind: 'explosion', x: x, y: y, color: color }); },
      function (victim, killer) {
        HR.pushKillFeed(gameState, victim, killer);
        broadcastEvent({ kind: 'killfeed', killFeed: gameState.killFeed });
      }
    );

    HR.updateStorm(gameState);
    HR.countAlive(gameState);

    var winner = HR.checkWinner(gameState);
    if (winner) {
      gameState.started = false;
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

  function renderLoop() {
    if (!gameState.started && !gameState.winner) {
      requestAnimationFrame(renderLoop);
      return;
    }

    if (mode === 'client' && gameState.started) {
      net.sendInput(HR.getInputSnapshot(canvas));
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
