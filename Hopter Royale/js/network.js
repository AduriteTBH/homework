(function (HR) {
  HR.NetworkManager = function (handlers) {
    this.handlers = handlers;
    this.peer = null;
    this.connections = {};
    this.hostConnection = null;
    this.isHost = false;
    this.roomCode = '';
    this.myPeerId = null;
    this.connected = false;
  };

  HR.NetworkManager.prototype.destroy = function () {
    var self = this;
    Object.values(this.connections).forEach(function (c) {
      try { c.close(); } catch (e) { /* noop */ }
    });
    this.connections = {};
    if (this.hostConnection) {
      try { this.hostConnection.close(); } catch (e) { /* noop */ }
      this.hostConnection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) { /* noop */ }
      this.peer = null;
    }
    this.connected = false;
  };

  HR.NetworkManager.prototype.createRoom = function (onStatus) {
    var self = this;
    this.isHost = true;
    this.destroy();

    function tryAttempt(attempt) {
      if (attempt >= 8) {
        return Promise.reject(new Error('Could not claim a room code. Try again.'));
      }

      var code = HR.generateRoomCode(HR.CONFIG.ROOM_CODE_LEN);
      var peerId = HR.CONFIG.PEER_PREFIX + code;

      if (onStatus) onStatus('Opening channel… (' + (attempt + 1) + '/8)');

      return self.initPeer(peerId).then(function () {
        self.roomCode = code;
        self.myPeerId = peerId;
        self.connected = true;
        self.peer.on('connection', function (conn) {
          self.handleIncoming(conn);
        });
        return code;
      }).catch(function (err) {
        if (err && (err.type === 'unavailable-id' || err.message === 'unavailable-id')) {
          self.destroy();
          return tryAttempt(attempt + 1);
        }
        throw err;
      });
    }

    return tryAttempt(0);
  };

  HR.NetworkManager.prototype.joinRoom = function (code, onStatus) {
    var self = this;
    this.isHost = false;
    this.destroy();
    this.roomCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, HR.CONFIG.ROOM_CODE_LEN);

    if (this.roomCode.length !== HR.CONFIG.ROOM_CODE_LEN) {
      return Promise.reject(new Error('Enter a valid 5-character room code.'));
    }

    var hostId = HR.CONFIG.PEER_PREFIX + this.roomCode;
    if (onStatus) onStatus('Connecting to host…');

    return this.initPeer().then(function () {
      self.myPeerId = self.peer.id;

      return new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () {
          reject(new Error('Host not found. Check the code and try again.'));
        }, 15000);

        var conn = self.peer.connect(hostId, {
          reliable: true,
          serialization: 'json',
        });

        self.hostConnection = conn;

        conn.on('open', function () {
          clearTimeout(timeout);
          self.connected = true;
          conn.send({ type: 'JOIN', name: self.handlers.getName() });
          resolve(self.roomCode);
        });

        conn.on('data', function (data) {
          self.handleMessage(data);
        });

        conn.on('close', function () {
          if (self.handlers.onHostDisconnected) self.handlers.onHostDisconnected();
        });

        conn.on('error', function () {
          clearTimeout(timeout);
          reject(new Error('Connection failed. Is the host still in the lobby?'));
        });
      });
    });
  };

  HR.NetworkManager.prototype.initPeer = function (customId) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var options = Object.assign({}, HR.PEER_CONFIG);
      if (customId) options.id = customId;

      self.peer = customId ? new Peer(customId, options) : new Peer(options);

      function onOpen(id) {
        self.myPeerId = id;
        self.peer.off('open', onOpen);
        self.peer.off('error', onError);
        resolve(id);
      }

      function onError(err) {
        self.peer.off('open', onOpen);
        self.peer.off('error', onError);
        reject(err);
      }

      self.peer.on('open', onOpen);
      self.peer.on('error', onError);

      self.peer.on('disconnected', function () {
        if (self.peer && !self.peer.destroyed) {
          try { self.peer.reconnect(); } catch (e) { /* noop */ }
        }
      });
    });
  };

  HR.NetworkManager.prototype.handleIncoming = function (conn) {
    var self = this;

    conn.on('open', function () {
      self.connections[conn.peer] = conn;

      conn.on('data', function (data) {
        if (data.type === 'JOIN') {
          if (self.handlers.onPlayerJoin) self.handlers.onPlayerJoin(conn.peer, data.name, conn);
          conn.send({
            type: 'JOIN_ACK',
            peerId: conn.peer,
            players: self.handlers.getLobbyPlayers ? self.handlers.getLobbyPlayers() : {},
          });
          self.broadcast({ type: 'LOBBY_UPDATE', players: self.handlers.getLobbyPlayers() });
        } else if (data.type === 'INPUT') {
          if (self.handlers.onPlayerInput) self.handlers.onPlayerInput(conn.peer, data.input);
        }
      });

      conn.on('close', function () {
        delete self.connections[conn.peer];
        if (self.handlers.onPlayerLeave) self.handlers.onPlayerLeave(conn.peer);
      });

      conn.on('error', function () {
        delete self.connections[conn.peer];
        if (self.handlers.onPlayerLeave) self.handlers.onPlayerLeave(conn.peer);
      });
    });
  };

  HR.NetworkManager.prototype.handleMessage = function (data) {
    switch (data.type) {
      case 'JOIN_ACK':
        if (this.handlers.onJoinAck) this.handlers.onJoinAck(data);
        break;
      case 'LOBBY_UPDATE':
        if (this.handlers.onLobbyUpdate) this.handlers.onLobbyUpdate(data.players);
        break;
      case 'START_GAME':
        if (this.handlers.onStartGame) this.handlers.onStartGame(data.state, data.youAre);
        break;
      case 'STATE_UPDATE':
        if (this.handlers.onStateUpdate) this.handlers.onStateUpdate(data.state);
        break;
      case 'EVENT':
        if (this.handlers.onEvent) this.handlers.onEvent(data);
        break;
      case 'GAME_OVER':
        if (this.handlers.onGameOver) this.handlers.onGameOver(data.winner);
        break;
      default:
        break;
    }
  };

  HR.NetworkManager.prototype.broadcast = function (msg, exceptPeer) {
    var self = this;
    Object.keys(this.connections).forEach(function (id) {
      if (id !== exceptPeer && self.connections[id].open) {
        self.connections[id].send(msg);
      }
    });
  };

  HR.NetworkManager.prototype.sendToHost = function (msg) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(msg);
    }
  };

  HR.NetworkManager.prototype.sendInput = function (input) {
    if (this.isHost) return;
    this.sendToHost({ type: 'INPUT', input: input });
  };

  HR.NetworkManager.prototype.broadcastState = function (state) {
    this.broadcast({ type: 'STATE_UPDATE', state: state });
  };

  HR.NetworkManager.prototype.startGameForAll = function (state) {
    var self = this;
    Object.keys(this.connections).forEach(function (peerId) {
      if (self.connections[peerId].open) {
        self.connections[peerId].send({ type: 'START_GAME', state: state, youAre: peerId });
      }
    });
  };

  HR.NetworkManager.prototype.broadcastEvent = function (event) {
    var payload = Object.assign({ type: 'EVENT' }, event);
    this.broadcast(payload);
  };
})(window.HR);
