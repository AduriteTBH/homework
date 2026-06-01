(function (HR) {
  var screens = {
    menu: document.getElementById('menu-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-ui'),
    stats: document.getElementById('stats-screen'),
    loading: document.getElementById('loading-screen'),
  };
  var lastKillFeedKey = '';
  var lbRows = {};
  var menuIntroDone = false;

  function resetLeaderboardDom() {
    lbRows = {};
    var list = document.getElementById('leaderboard-list');
    if (list) list.innerHTML = '';
  }

  HR.showScreen = function (name) {
    Object.values(screens).forEach(function (el) {
      if (el) {
        el.classList.remove('screen-enter');
        el.classList.add('hidden');
      }
    });

    document.body.classList.remove('at-menu', 'at-lobby', 'in-game');
    if (name === 'menu') document.body.classList.add('at-menu');
    else if (name === 'lobby') document.body.classList.add('at-lobby');
    else if (name === 'game') document.body.classList.add('in-game');
    else if (name === 'stats') document.body.classList.add('at-stats');

    if (screens[name]) {
      screens[name].classList.remove('hidden');
      requestAnimationFrame(function () {
        screens[name].classList.add('screen-enter');
      });
    }

    if (name === 'menu' || name === 'lobby') {
      if (HR.audio && HR.audio.startMenuMusic) HR.audio.startMenuMusic();
    }
    if (name === 'game') {
      if (HR.audio && HR.audio.startBattleMusic) HR.audio.startBattleMusic();
    }
    if (name === 'menu' && HR.initMenuScene) HR.initMenuScene(false);
  };

  function playMenuIntro() {
    if (menuIntroDone) return;
    menuIntroDone = true;
    document.body.classList.add('menu-intro-done');
  }

  HR.initGameHud = function () {
    lastKillFeedKey = '';
    resetLeaderboardDom();
    HR.updateKillFeed([]);
    document.querySelectorAll('.hud-panel, .hud-chip').forEach(function (el, i) {
      el.classList.remove('hud-enter');
      void el.offsetWidth;
      el.style.animationDelay = (i * 0.06) + 's';
      el.classList.add('hud-enter');
    });
  };

  HR.setMenuStatus = function (msg, isError) {
    var el = document.getElementById('menu-status');
    if (!el) return;
    if (!msg) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.toggle('error', isError !== false);
  };

  HR.setLobbyStatus = function (msg) {
    var el = document.getElementById('lobby-status');
    if (el) el.textContent = msg || '';
  };

  HR.setPlayerName = function (name) {
    var el = document.getElementById('player-name-display');
    if (el) el.textContent = name;
  };

  HR.setRoomCode = function (code) {
    var el = document.getElementById('room-code-display');
    if (el) el.textContent = code;
  };

  HR.updateLobbyList = function (players) {
    var list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = '';

    Object.values(players)
      .filter(function (p) { return !p.isBot; })
      .forEach(function (p) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="pilot-dot"></span>' + p.name + (p.isHost ? ' <em>(Host)</em>' : '');
        list.appendChild(li);
      });

    HR.updateLobbyBotFill(players);
  };

  HR.updateLobbyBotFill = function (players) {
    var el = document.getElementById('lobby-bot-fill');
    if (!el) return;
    var humans = Object.values(players).filter(function (p) { return !p.isBot; }).length;
    var max = HR.CONFIG.MAX_PLAYERS;
    var bots = Math.max(0, max - humans);
    el.textContent = bots > 0
      ? humans + ' pilots · ' + bots + ' bots at launch (' + max + ' total)'
      : 'Full lobby — ' + max + ' human pilots';
  };

  HR.updateHud = function (state, me) {
    var p = (state.players && state.players[me.id]) ? state.players[me.id] : me;
    var aliveEl = document.getElementById('hud-alive');
    var killsEl = document.getElementById('hud-kills');
    if (aliveEl) aliveEl.textContent = 'Alive: ' + state.aliveCount;
    if (killsEl) killsEl.textContent = 'KOs: ' + (p.kills || 0);

    if (p.alive) {
      document.getElementById('hud-hp-bar').style.width = ((p.hp / p.maxHp) * 100) + '%';
      document.getElementById('hud-xp-bar').style.width = ((p.xp / HR.xpNeeded(p.level)) * 100) + '%';
      document.getElementById('hud-level').textContent = 'Level ' + p.level;

      var dashBar = document.getElementById('hud-dash-bar');
      if (dashBar) {
        var maxCd = HR.CONFIG.DASH_COOLDOWN;
        var cd = p.dashCooldown || 0;
        var ready = cd <= 0 && !(p.dashTimer > 0);
        dashBar.style.width = ready ? '100%' : ((1 - cd / maxCd) * 100) + '%';
        dashBar.parentElement.classList.toggle('dash-ready', ready);
      }
    }

    HR.updateLeaderboard(state, me.id);
  };

  HR.updateLeaderboard = function (state, myId) {
    var list = document.getElementById('leaderboard-list');
    if (!list) return;

    var rows = Object.values(state.players)
      .filter(function (p) { return p.alive; })
      .sort(function (a, b) {
        if (b.kills !== a.kills) return (b.kills || 0) - (a.kills || 0);
        if (b.level !== a.level) return b.level - a.level;
        return b.hp - a.hp;
      })
      .slice(0, 8);

    var aliveIds = {};
    rows.forEach(function (p, i) {
      aliveIds[p.id] = true;
      var li = lbRows[p.id];
      var isNew = !li;

      if (isNew) {
        li = document.createElement('li');
        li.className = 'lb-row lb-new';
        li.dataset.playerId = p.id;
        li.innerHTML =
          '<span class="lb-rank"></span>' +
          '<span class="lb-name"></span>' +
          '<span class="lb-stat lb-kills"></span>' +
          '<span class="lb-stat lb-level"></span>';
        lbRows[p.id] = li;
        window.setTimeout(function () { li.classList.remove('lb-new'); }, 450);
      }

      li.querySelector('.lb-rank').textContent = String(i + 1);
      li.querySelector('.lb-name').textContent = p.name;
      li.querySelector('.lb-kills').textContent = (p.kills || 0) + 'K';
      li.querySelector('.lb-level').textContent = 'Lv' + p.level;
      li.classList.toggle('me', p.id === myId);
      li.classList.toggle('bot', !!p.isBot);
      
      if (list.children[i] !== li) {
        list.insertBefore(li, list.children[i]);
      }
    });

    Object.keys(lbRows).forEach(function (id) {
      if (!aliveIds[id]) {
        lbRows[id].remove();
        delete lbRows[id];
      }
    });
  };

  function killFeedKey(feed) {
    if (!feed || !feed.length) return 'empty';
    return feed.map(function (e) { return (e.time || 0) + ':' + e.text; }).join('|');
  }

  HR.updateKillFeed = function (feed) {
    var el = document.getElementById('kill-feed');
    if (!el) return;

    var key = killFeedKey(feed);
    if (key === lastKillFeedKey) return;
    lastKillFeedKey = key;

    if (!feed || !feed.length) {
      el.innerHTML = '<div class="kill-entry empty">No eliminations yet</div>';
      return;
    }

    // Only append new items
    feed.forEach(function (entry) {
      var id = 'kill-' + entry.time + '-' + (entry.killer || '') + '-' + (entry.victim || '');
      if (document.getElementById(id)) return; // Already rendered

      var div = document.createElement('div');
      div.id = id;
      div.className = 'kill-entry';

      if (entry.killer && entry.victim) {
        div.innerHTML =
          '<span class="kill-killer">' + entry.killer + '</span>' +
          '<span class="kill-verb"> eliminated </span>' +
          '<span class="kill-victim">' + entry.victim + '</span>';
      } else if (entry.victim) {
        div.innerHTML =
          '<span class="kill-victim">' + entry.victim + '</span>' +
          '<span class="kill-verb"> was lost</span>';
      } else {
        div.textContent = entry.text;
      }

      el.appendChild(div);
    });

    // Remove empty message if present
    var emptyMsg = el.querySelector('.kill-entry.empty');
    if (emptyMsg) emptyMsg.remove();

    // Remove old entries to prevent infinite scrolling list
    while (el.children.length > feed.length) {
      el.removeChild(el.firstChild);
    }
    
    // Auto-scroll to bottom
    el.scrollTop = el.scrollHeight;
  };

  HR.showGameOver = function (winner, me) {
    var panel = document.getElementById('game-over-screen');
    var text = document.getElementById('game-over-text');
    var sub = document.getElementById('game-over-sub');
    if (!panel || !text) return;

    if (winner && winner.id === me.id) {
      text.textContent = 'Victory!';
      sub.textContent = 'You are the last pilot standing.';
    } else if (winner) {
      text.textContent = 'Mission Failed';
      sub.textContent = winner.name + ' won the battle.';
    } else {
      text.textContent = 'DESTROYED';
      sub.textContent = 'Your hopter was destroyed in combat.';
    }
    panel.classList.remove('hidden');
    requestAnimationFrame(function () { panel.classList.add('overlay-enter'); });
  };

  HR.toggleHostStart = function (isHost) {
    var btn = document.getElementById('btn-start-game');
    var settingsPanel = document.getElementById('host-settings-panel');
    if (btn) btn.classList.toggle('hidden', !isHost);
    if (settingsPanel) settingsPanel.classList.toggle('hidden', !isHost);
  };

  HR.copyRoomCode = function (code) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(code).then(function () {
        HR.setLobbyStatus('Code copied!');
        setTimeout(function () { HR.setLobbyStatus(''); }, 2000);
      }).catch(function () {
        HR.setLobbyStatus('Share: ' + code);
      });
    }
    HR.setLobbyStatus('Share: ' + code);
    return Promise.resolve();
  };

  HR.toggleMapExpanded = function () {
    var map = document.getElementById('minimap-container');
    if (map) {
      map.classList.toggle('expanded');
      window.dispatchEvent(new Event('resize'));
    }
  };

  function closeJoinPanel() {
    var panel = document.getElementById('join-panel');
    if (panel) panel.classList.add('panel-closed');
  }

  function openJoinPanel() {
    closeJoinPanel();
    var panel = document.getElementById('join-panel');
    if (panel) {
      panel.classList.remove('panel-closed');
      document.getElementById('join-code-input').focus();
    }
  }

  HR.bindMenuHandlers = function (handlers) {
    document.querySelectorAll('.portal-item[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        
        if (action !== 'mute') {
          document.querySelectorAll('.portal-item').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
        }
        
        if (HR.audio) HR.audio.ui();

        if (action === 'solo') handlers.onSolo();
        else if (action === 'host') {
          if (window.HR_ENV && !HR_ENV.guardMultiplayer()) return;
          handlers.onCreate();
        }
        else if (action === 'join') {
          if (window.HR_ENV && !HR_ENV.guardMultiplayer()) return;
          openJoinPanel();
        }
        else if (action === 'mute' && HR.audio) {
          var m = HR.audio.toggleMute();
          btn.textContent = m ? 'Music: OFF' : 'Music: ON';
          btn.style.color = m ? '#ff6b6b' : '';
        }
      });

      btn.addEventListener('mouseenter', function () {
        document.querySelectorAll('.portal-item').forEach(function (b) { b.classList.remove('hover'); });
        btn.classList.add('hover');
      });
      btn.addEventListener('mouseleave', function () {
        btn.classList.remove('hover');
      });
    });

    document.getElementById('btn-join-game').addEventListener('click', function () {
      closeJoinPanel();
      handlers.onJoin();
    });

    var variants = ['base', 'scout', 'heavy', 'phantom', 'spectre', 'apache', 'viper', 'goliath', 'wraith', 'titan'];
    var currentV = variants.indexOf(HR.myVariant);
    if (currentV < 0) currentV = 0;
    HR.myVariant = variants[currentV];

    function updatePreview() {
      var v = variants[currentV];
      HR.myVariant = v;
      if (HR.prefs) HR.prefs.save(undefined, v, undefined);
      var lbl = document.getElementById('variant-label');
      if(lbl) lbl.textContent = v;
    }

    var btnNext = document.getElementById('btn-next-variant');
    if(btnNext) {
      btnNext.addEventListener('click', function() {
        currentV = (currentV + 1) % variants.length;
        updatePreview();
        if(HR.audio) HR.audio.ui();
      });
    }

    var btnPrev = document.getElementById('btn-prev-variant');
    if(btnPrev) {
      btnPrev.addEventListener('click', function() {
        currentV = (currentV - 1 + variants.length) % variants.length;
        updatePreview();
        if(HR.audio) HR.audio.ui();
      });
    }

    var colorPalette = document.getElementById('color-palette');
    if (colorPalette && HR.PLAYER_COLORS) {
      colorPalette.innerHTML = '';
      var activeColor = HR.myColor || HR.PLAYER_COLORS[0];
      HR.myColor = activeColor;
      HR.PLAYER_COLORS.forEach(function(c, i) {
        var btn = document.createElement('div');
        btn.className = 'color-swatch' + (c === activeColor ? ' active' : '');
        btn.style.backgroundColor = c;
        btn.dataset.color = c;
        colorPalette.appendChild(btn);
      });
    }

    var swatches = document.querySelectorAll('.color-swatch');
    if (swatches.length) {
      swatches.forEach(function(btn) {
        btn.addEventListener('click', function() {
          swatches.forEach(function(b){ b.classList.remove('active'); });
          btn.classList.add('active');
          HR.myColor = btn.dataset.color;
          if (HR.prefs) HR.prefs.save(HR.myColor, undefined, undefined);
          if (HR.audio) HR.audio.ui();
        });
      });
    }

    var btnNextName = document.getElementById('btn-next-callsign');
    var btnPrevName = document.getElementById('btn-prev-callsign');
    var currentNameIdx = 0;
    
    function updateCallsignUI(n) {
      var lbl = document.getElementById('callsign-label');
      if(lbl) lbl.textContent = n;
      HR.myCallsign = n;
      if (HR.prefs) HR.prefs.save(undefined, undefined, n);
      if (HR.setPlayerName) HR.setPlayerName(n);
    }

    if(btnNextName && btnPrevName) {
      btnNextName.addEventListener('click', function() {
        if(handlers.onCycleName) handlers.onCycleName(1, updateCallsignUI);
        if(HR.audio) HR.audio.ui();
      });
      btnPrevName.addEventListener('click', function() {
        if(handlers.onCycleName) handlers.onCycleName(-1, updateCallsignUI);
        if(HR.audio) HR.audio.ui();
      });
    }

    document.querySelectorAll('[data-close-panel]').forEach(function (btn) {
      btn.addEventListener('click', closeJoinPanel);
    });

    document.getElementById('btn-start-game').addEventListener('click', handlers.onStart);
    document.getElementById('btn-copy-code').addEventListener('click', handlers.onCopyCode);
    document.getElementById('btn-return-base').addEventListener('click', function () { location.reload(); });
    
    var playAgainBtn = document.getElementById('btn-play-again');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', function() {
        var goScreen = document.getElementById('game-over-screen');
        if (goScreen) goScreen.classList.add('hidden');
        if (HR.restartMatch) {
          HR.restartMatch();
        } else {
          location.reload();
        }
      });
    }

    if (document.getElementById('btn-lobby-back')) {
      document.getElementById('btn-lobby-back').addEventListener('click', function () {
        HR.showScreen('menu');
      });
    }

    var statsBtn = document.getElementById('btn-stats');
    if (statsBtn) {
      statsBtn.addEventListener('click', function() {
        HR.showScreen('stats');
      });
    }

    // Add hover sound effects to all buttons
    document.querySelectorAll('button, .portal-item').forEach(function(btn) {
      btn.addEventListener('mouseenter', function() {
        if (HR.audio && HR.audio.uiHover) HR.audio.uiHover();
      });
    });

    var statsBackBtn = document.getElementById('btn-stats-back');
    if (statsBackBtn) {
      statsBackBtn.addEventListener('click', function() {
        HR.showScreen('menu');
      });
    }

    if (HR.updateStatsUI) HR.updateStatsUI();

    var joinInput = document.getElementById('join-code-input');
    if (joinInput) {
      joinInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          closeJoinPanel();
          handlers.onJoin();
        }
      });
    }

    window.addEventListener('keydown', function (e) {
      if (e.key.toLowerCase() === 'm' && !screens.game.classList.contains('hidden')) {
        HR.toggleMapExpanded();
      }
    });

    if (HR.initMenuScene) HR.initMenuScene(true);
    playMenuIntro();
  };

  HR.updateStatsUI = function() {
    var games = document.getElementById('stat-games');
    if (games) games.textContent = HR.stats.games;
    var kills = document.getElementById('stat-kills');
    if (kills) kills.textContent = HR.stats.kills;
    var wins = document.getElementById('stat-wins');
    if (wins) wins.textContent = HR.stats.wins;

    var hint = document.getElementById('callsign-unlock-hint');
    var input = document.getElementById('callsign-input');
    var label = document.getElementById('callsign-label');
    var prev = document.getElementById('btn-prev-callsign');
    var next = document.getElementById('btn-next-callsign');

    if (HR.stats.wins >= 3) {
      if (hint) hint.innerHTML = '<span style="color:#2ecc71;">Custom callsigns unlocked!</span>';
      if (input) input.classList.remove('hidden');
      if (label) label.classList.add('hidden');
      if (prev) prev.classList.add('hidden');
      if (next) next.classList.add('hidden');

      if (input && !input.hasAttribute('data-bound')) {
        input.setAttribute('data-bound', 'true');
        input.value = HR.myCallsign || label.textContent || 'Player';
        HR.myCallsign = input.value;
        if (HR.setPlayerName) HR.setPlayerName(HR.myCallsign);
        input.addEventListener('input', function() {
          HR.myCallsign = input.value.trim() || 'Player';
          if (HR.prefs) HR.prefs.save(undefined, undefined, HR.myCallsign);
          if (HR.setPlayerName) HR.setPlayerName(HR.myCallsign);
        });
      }
    }
  };
})(window.HR);
