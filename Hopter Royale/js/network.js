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

  HR.NetworkManager.prototype.initRoom = function(code, asHost, onStatus) {
    var self = this;
    this.isHost = asHost;
    this.roomCode = code;
    this.destroy();
    
    if (onStatus) onStatus(asHost ? 'Opening channel...' : 'Connecting to host...');
    
    return new Promise(function(resolve, reject) {
      try {
        self.room = trystero.joinRoom({ appId: HR.CONFIG.FIREBASE_APP_ID }, code);
      } catch (err) {
        return reject(new Error('Failed to initialize multiplayer room.'));
      }
      
      var aJoin = self.room.makeAction('JOIN');
      self.actions.sendJoin = aJoin[0];
      var getJoin = aJoin[1];
      
      var aJoinAck = self.room.makeAction('JOIN_ACK');
      self.actions.sendJoinAck = aJoinAck[0];
      var getJoinAck = aJoinAck[1];
      
      var aLobbyUpdate = self.room.makeAction('LOBBY_UPDATE');
      self.actions.sendLobbyUpdate = aLobbyUpdate[0];
      var getLobbyUpdate = aLobbyUpdate[1];
      
      var aStartGame = self.room.makeAction('START_GAME');
      self.actions.sendStartGame = aStartGame[0];
      var getStartGame = aStartGame[1];
      
      var aStateUpdate = self.room.makeAction('STATE_UPDATE');
      self.actions.sendStateUpdate = aStateUpdate[0];
      var getStateUpdate = aStateUpdate[1];
      
      var aEvent = self.room.makeAction('EVENT');
      self.actions.sendEvent = aEvent[0];
      var getEvent = aEvent[1];

      var aGameOver = self.room.makeAction('GAME_OVER');
      self.actions.sendGameOver = aGameOver[0];
      var getGameOver = aGameOver[1];
      
      var aInput = self.room.makeAction('INPUT');
      self.actions.sendInput = aInput[0];
      var getInput = aInput[1];
      
      getJoin(function(data, peerId) {
        if (!self.isHost) return;
        if (self.handlers.onPlayerJoin) self.handlers.onPlayerJoin(peerId, data.name, peerId);
        self.actions.sendJoinAck({
          peerId: peerId,
          players: self.handlers.getLobbyPlayers ? self.handlers.getLobbyPlayers() : {}
        }, peerId);
        self.actions.sendLobbyUpdate({ players: self.handlers.getLobbyPlayers() });
      });
      
      getJoinAck(function(data, peerId) {
        if (self.isHost) return;
        self.hostId = peerId;
        self.connected = true;
        if (self.handlers.onJoinAck) self.handlers.onJoinAck(data);
        resolve(code);
      });
      
      getLobbyUpdate(function(data, peerId) {
        if (self.isHost || peerId !== self.hostId) return;
        if (self.handlers.onLobbyUpdate) self.handlers.onLobbyUpdate(data.players);
      });
      
      getStartGame(function(data, peerId) {
        if (self.isHost || peerId !== self.hostId) return;
        if (self.handlers.onStartGame) self.handlers.onStartGame(data.state, data.youAre);
      });
      
      getStateUpdate(function(state, peerId) {
        if (self.isHost || peerId !== self.hostId) return;
        if (self.handlers.onStateUpdate) self.handlers.onStateUpdate(state);
      });
      
      getEvent(function(data, peerId) {
        if (self.isHost || peerId !== self.hostId) return;
        if (self.handlers.onEvent) self.handlers.onEvent(data);
      });

      getGameOver(function(data, peerId) {
        if (self.isHost || peerId !== self.hostId) return;
        if (self.handlers.onGameOver) self.handlers.onGameOver(data.winner);
      });
      
      getInput(function(input, peerId) {
        if (!self.isHost) return;
        if (self.handlers.onPlayerInput) self.handlers.onPlayerInput(peerId, input);
      });
      
      self.room.onPeerJoin(function(peerId) {
        self.connections[peerId] = true;
        if (!self.isHost) {
          self.actions.sendJoin({ name: self.handlers.getName() }, peerId);
        }
      });
      
      self.room.onPeerLeave(function(peerId) {
        delete self.connections[peerId];
        if (self.isHost) {
          if (self.handlers.onPlayerLeave) self.handlers.onPlayerLeave(peerId);
        } else {
          if (peerId === self.hostId) {
            if (self.handlers.onHostDisconnected) self.handlers.onHostDisconnected();
          }
        }
      });

      if (asHost) {
        self.connected = true;
        resolve(code);
      } else {
        setTimeout(function() {
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
})(window.HR);
