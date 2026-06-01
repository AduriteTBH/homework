(function (HR) {
  HR.NetworkManager = function (handlers) {
    this.handlers = handlers;
    this.room = null;
    this.connections = {};
    this.isHost = false;
    this.roomCode = '';
    this.myPeerId = null;
    this.hostId = null;
    this.connected = false;
    this.actions = {};
  };

  HR.NetworkManager.prototype.destroy = function () {
    if (this.room) {
      try { this.room.leave(); } catch (e) { /* noop */ }
      this.room = null;
    }
    this.connections = {};
    this.connected = false;
    this.hostId = null;
  };

  HR.NetworkManager.prototype.initRoom = function (code, asHost, onStatus) {
    var self = this;
    this.isHost = asHost;
    this.roomCode = code;
    this.destroy();

    if (onStatus) onStatus(asHost ? 'Opening channel...' : 'Connecting to host...');

    return new Promise(function (resolve, reject) {
      try {
        self.room = trystero.joinRoom({ appId: HR.CONFIG.FIREBASE_APP_ID }, code);
      } catch (err) {
        return reject(new Error('Failed to initialize multiplayer room.'));
      }

      // Get our own peer ID (new API exposes it on the room object)
      self.myPeerId = self.room.selfId || null;

      // New API: makeAction() returns an object with .send and .onMessage
      var aJoin       = self.room.makeAction('JOIN');
      var aJoinAck    = self.room.makeAction('JOIN_ACK');
      var aLobbyUpdate= self.room.makeAction('LOBBY_UPDATE');
      var aStartGame  = self.room.makeAction('START_GAME');
      var aStateUpdate= self.room.makeAction('STATE_UPDATE');
      var aEvent      = self.room.makeAction('EVENT');
      var aGameOver   = self.room.makeAction('GAME_OVER');
      var aInput      = self.room.makeAction('INPUT');

      // Store send references (wrapping so targeted sends work: send(data, peerId))
      self.actions.sendJoin        = function (d, t) { aJoin.send(d, t); };
      self.actions.sendJoinAck     = function (d, t) { aJoinAck.send(d, t); };
      self.actions.sendLobbyUpdate = function (d)    { aLobbyUpdate.send(d); };
      self.actions.sendStartGame   = function (d, t) { aStartGame.send(d, t); };
      self.actions.sendStateUpdate = function (d)    { aStateUpdate.send(d); };
      self.actions.sendEvent       = function (d)    { aEvent.send(d); };
      self.actions.sendGameOver    = function (d)    { aGameOver.send(d); };
      self.actions.sendInput       = function (d, t) { aInput.send(d, t); };

      // New API: assign .onMessage handlers (receives data + {peerId} metadata)
      aJoin.onMessage = function (data, info) {
        if (!self.isHost) return;
        var peerId = info.peerId;
        if (self.handlers.onPlayerJoin) self.handlers.onPlayerJoin(peerId, data.name, peerId);
        aJoinAck.send({
          peerId: peerId,
          players: self.handlers.getLobbyPlayers ? self.handlers.getLobbyPlayers() : {}
        }, peerId);
        aLobbyUpdate.send({ players: self.handlers.getLobbyPlayers() });
      };

      aJoinAck.onMessage = function (data, info) {
        if (self.isHost) return;
        self.hostId = info.peerId;
        self.connected = true;
        if (self.handlers.onJoinAck) self.handlers.onJoinAck(data);
        resolve(code);
      };

      aLobbyUpdate.onMessage = function (data, info) {
        if (self.isHost || info.peerId !== self.hostId) return;
        if (self.handlers.onLobbyUpdate) self.handlers.onLobbyUpdate(data.players);
      };

      aStartGame.onMessage = function (data, info) {
        if (self.isHost || info.peerId !== self.hostId) return;
        if (self.handlers.onStartGame) self.handlers.onStartGame(data.state, data.youAre);
      };

      aStateUpdate.onMessage = function (state, info) {
        if (self.isHost || info.peerId !== self.hostId) return;
        if (self.handlers.onStateUpdate) self.handlers.onStateUpdate(state);
      };

      aEvent.onMessage = function (data, info) {
        if (self.isHost || info.peerId !== self.hostId) return;
        if (self.handlers.onEvent) self.handlers.onEvent(data);
      };

      aGameOver.onMessage = function (data, info) {
        if (self.isHost || info.peerId !== self.hostId) return;
        if (self.handlers.onGameOver) self.handlers.onGameOver(data.winner);
      };

      aInput.onMessage = function (input, info) {
        if (!self.isHost) return;
        if (self.handlers.onPlayerInput) self.handlers.onPlayerInput(info.peerId, input);
      };

      // New API: onPeerJoin / onPeerLeave are property assignments, not function calls
      self.room.onPeerJoin = function (peerId) {
        self.connections[peerId] = true;
        if (!self.isHost) {
          aJoin.send({ name: self.handlers.getName() }, peerId);
        }
      };

      self.room.onPeerLeave = function (peerId) {
        delete self.connections[peerId];
        if (self.isHost) {
          if (self.handlers.onPlayerLeave) self.handlers.onPlayerLeave(peerId);
        } else {
          if (peerId === self.hostId) {
            if (self.handlers.onHostDisconnected) self.handlers.onHostDisconnected();
          }
        }
      };

      if (asHost) {
        self.connected = true;
        resolve(code);
      } else {
        setTimeout(function () {
          if (!self.connected) {
            self.destroy();
            reject(new Error('Host not found. Check the code and try again.'));
          }
        }, 15000);
      }
    });
  };

  HR.NetworkManager.prototype.createRoom = function (onStatus) {
    var code = HR.generateRoomCode(HR.CONFIG.ROOM_CODE_LEN);
    return this.initRoom(code, true, onStatus);
  };

  HR.NetworkManager.prototype.joinRoom = function (code, onStatus) {
    var cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, HR.CONFIG.ROOM_CODE_LEN);
    if (cleanCode.length !== HR.CONFIG.ROOM_CODE_LEN) {
      return Promise.reject(new Error('Enter a valid 5-character room code.'));
    }
    return this.initRoom(cleanCode, false, onStatus);
  };

  HR.NetworkManager.prototype.sendInput = function (input) {
    if (this.isHost || !this.actions.sendInput) return;
    this.actions.sendInput(input, this.hostId);
  };

  HR.NetworkManager.prototype.broadcastState = function (state) {
    if (this.actions.sendStateUpdate) this.actions.sendStateUpdate(state);
  };

  HR.NetworkManager.prototype.startGameForAll = function (state) {
    var self = this;
    Object.keys(this.connections).forEach(function (peerId) {
      if (self.actions.sendStartGame) {
        self.actions.sendStartGame({ state: state, youAre: peerId }, peerId);
      }
    });
  };

  HR.NetworkManager.prototype.broadcastEvent = function (event) {
    if (event.type === 'GAME_OVER') {
      if (this.actions.sendGameOver) this.actions.sendGameOver({ winner: event.winner });
    } else {
      if (this.actions.sendEvent) {
        var payload = Object.assign({ type: 'EVENT' }, event);
        this.actions.sendEvent(payload);
      }
    }
  };

  // General-purpose broadcast used by main.js for LOBBY_UPDATE and GAME_OVER
  HR.NetworkManager.prototype.broadcast = function (data) {
    if (!data || !data.type) return;
    if (data.type === 'LOBBY_UPDATE') {
      if (this.actions.sendLobbyUpdate) this.actions.sendLobbyUpdate({ players: data.players });
    } else if (data.type === 'GAME_OVER') {
      if (this.actions.sendGameOver) this.actions.sendGameOver({ winner: data.winner });
    }
  };
})(window.HR);
