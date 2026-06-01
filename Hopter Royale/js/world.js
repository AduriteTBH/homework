(function (HR) {
  HR.createInitialState = function () {
    return {
      started: false,
      players: {},
      bullets: [],
      crates: [],
      gems: [],
      powerups: [],
      storm: {
        x: HR.CONFIG.MAP_SIZE / 2,
        y: HR.CONFIG.MAP_SIZE / 2,
        radius: HR.CONFIG.MAP_SIZE * HR.CONFIG.STORM_START_RATIO,
      },
      aliveCount: 0,
      killFeed: [],
      winner: null,
      tick: 0,
    };
  };

  HR.spawnCrates = function (state, count) {
    count = count || HR.CONFIG.CRATE_COUNT;
    state.crates = [];
    for (var i = 0; i < count; i++) HR.spawnCrate(state);
  };

  HR.spawnCrate = function (state) {
    var x, y, valid;
    for (var attempts = 0; attempts < 15; attempts++) {
      var a = Math.random() * Math.PI * 2;
      var r = Math.random() * (HR.CONFIG.MAP_SIZE / 2 - 120);
      x = HR.CONFIG.MAP_SIZE / 2 + Math.cos(a) * r;
      y = HR.CONFIG.MAP_SIZE / 2 + Math.sin(a) * r;
      valid = true;
      for (var pid in state.players) {
        var p = state.players[pid];
        if (Math.hypot(p.x - x, p.y - y) < 180) {
          valid = false;
          break;
        }
      }
      if (valid) break;
    }
    
    state.crates.push({
      id: Math.random().toString(36).slice(2),
      x: x,
      y: y,
      hp: 45 + Math.floor(Math.random() * 25),
      type: Math.random() > 0.85 ? 'gold' : 'normal',
    });
  };

  HR.updateStorm = function (state) {
    if (state.storm.radius > HR.CONFIG.STORM_MIN_RADIUS) {
      state.storm.radius -= HR.CONFIG.STORM_SHRINK;
    }
  };

  HR.applyStormDamage = function (state, player) {
    var d = Math.hypot(player.x - state.storm.x, player.y - state.storm.y);
    if (d > state.storm.radius) {
      player.hp -= 0.75 + (d - state.storm.radius) * 0.002;
    }
  };

  HR.updateBullets = function (state, onExplosion, onKill) {
    var playersList = Object.values(state.players);
    for (var i = state.bullets.length - 1; i >= 0; i--) {
      var b = state.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      if (b.life <= 0) {
        state.bullets.splice(i, 1);
        continue;
      }

      var hit = false;

      playersList.forEach(function (p) {
        if (hit || !p.alive || p.id === b.ownerId) return;
        
        var owner = state.players[b.ownerId];
        var hitRadius = 30 + b.size;
        
        // If a human is shooting at a bot, make the bot's hitbox 2.2x larger!
        if (owner && !owner.isBot && p.isBot) {
          hitRadius = (30 * 2.2) + b.size;
        }

        // Fast bounding box check to prevent massive lag!
        if (Math.abs(p.x - b.x) > hitRadius || Math.abs(p.y - b.y) > hitRadius) return;

        if (Math.hypot(p.x - b.x, p.y - b.y) < hitRadius) {
          p.regenTimer = 0;
          if (p.shield && p.shield > 0) {
            var absorb = Math.min(p.shield, b.damage);
            p.shield -= absorb;
            p.hp -= (b.damage - absorb);
            state.damageTexts = state.damageTexts || [];
            state.damageTexts.push({ x: p.x, y: p.y - 20, text: Math.round(b.damage), life: 1.0, color: '#3498db' });
          } else {
            p.hp -= b.damage;
            state.damageTexts = state.damageTexts || [];
            state.damageTexts.push({ x: p.x, y: p.y - 20, text: Math.round(b.damage), life: 1.0, color: '#ff4757' });
          }
          hit = true;
          if (p.hp <= 0) {
            p.alive = false;
            var killer = state.players[b.ownerId];
            if (killer) killer.kills = (killer.kills || 0) + 1;
            if (onKill) onKill(p, killer);
            onExplosion(p.x, p.y, p.color);
          }
        }
      });

      if (!hit) {
        for (var c = state.crates.length - 1; c >= 0; c--) {
          var crate = state.crates[c];
          if (Math.abs(b.x - crate.x) < 20 && Math.abs(b.y - crate.y) < 20) {
            crate.hp -= b.damage;
            state.damageTexts = state.damageTexts || [];
            state.damageTexts.push({ x: crate.x, y: crate.y - 15, text: Math.round(b.damage), life: 1.0, color: '#fbc531' });
            hit = true;
            if (crate.hp <= 0) {
              onExplosion(crate.x, crate.y, crate.type === 'gold' ? '#fbc531' : '#9c88ff');
              var gemCount = crate.type === 'gold' ? 3 : 1;
              for (var g = 0; g < gemCount; g++) {
                state.gems.push({
                  x: crate.x + HR.rand(-12, 12),
                  y: crate.y + HR.rand(-12, 12),
                });
              }
              if (Math.random() < HR.CONFIG.POWERUP_CHANCE) {
                var types = HR.CONFIG.POWERUP_TYPES || ['health'];
                var pType = types[Math.floor(Math.random() * types.length)];
                state.powerups = state.powerups || [];
                state.powerups.push({
                  id: Math.random().toString(36).slice(2),
                  type: pType,
                  x: crate.x + HR.rand(-16, 16),
                  y: crate.y + HR.rand(-16, 16),
                });
              }
              state.crates.splice(c, 1);
            }
            break;
          }
        }
      }

      if (hit) state.bullets.splice(i, 1);
    }
  };

  HR.countAlive = function (state) {
    var n = 0;
    Object.values(state.players).forEach(function (p) {
      if (p.alive) n++;
    });
    state.aliveCount = n;
    return n;
  };

  HR.pushKillFeed = function (state, victim, killer) {
    state.killFeed.unshift({
      text: killer
        ? killer.name + ' eliminated ' + victim.name
        : victim.name + ' was lost',
      killer: killer ? killer.name : null,
      victim: victim.name,
      time: Date.now(),
    });
    state.killFeed = state.killFeed.slice(0, 6);
  };

  HR.checkWinner = function (state) {
    var alive = Object.values(state.players).filter(function (p) { return p.alive; });
    if (alive.length === 1 && state.started) {
      state.winner = alive[0];
      return alive[0];
    }
    if (alive.length === 0) state.winner = null;
    return state.winner;
  };
})(window.HR);
