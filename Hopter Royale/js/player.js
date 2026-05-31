(function (HR) {
  var colorIndex = 0;

  HR.emptyInput = function () {
    return { w: false, a: false, s: false, d: false, angle: 0, click: false, dash: false };
  };

  HR.xpNeeded = function (level) {
    return level * 30;
  };

  HR.createPlayer = function (id, name, isBot) {
    isBot = !!isBot;
    var color = isBot ? '#e1b12c' : (HR.myColor || HR.PLAYER_COLORS[colorIndex++ % HR.PLAYER_COLORS.length]);
    var variants = ['base', 'scout', 'heavy'];
    var variant = isBot ? variants[Math.floor(Math.random() * variants.length)] : (HR.myVariant || 'base');
    var maxHp = variant === 'heavy' ? 140 : (variant === 'scout' ? 80 : 100);
    return {
      id: id,
      name: name,
      isBot: isBot,
      alive: true,
      x: HR.rand(120, HR.CONFIG.MAP_SIZE - 120),
      y: HR.rand(120, HR.CONFIG.MAP_SIZE - 120),
      vx: 0,
      vy: 0,
      angle: 0,
      color: color,
      variant: variant,
      hp: maxHp,
      maxHp: maxHp,
      shield: 0,
      speedBoost: 0,
      level: 1,
      xp: 0,
      kills: 0,
      fireCooldown: 0,
      dashCooldown: 0,
      dashTimer: 0,
      input: HR.emptyInput(),
    };
  };

  HR.applyMovement = function (player) {
    var cfg = HR.CONFIG;
    var inp = player.input;
    var accel = cfg.ACCEL + player.level * 0.025;

    if (player.dashTimer > 0) {
      player.dashTimer--;
    } else {
      if (inp.w) player.vy -= accel;
      if (inp.s) player.vy += accel;
      if (inp.a) player.vx -= accel;
      if (inp.d) player.vx += accel;
    }

    var friction = player.dashTimer > 0 ? 0.96 : cfg.FRICTION;
    player.vx *= friction;
    player.vy *= friction;

    var speed = Math.hypot(player.vx, player.vy);
    var baseMaxSpd = player.variant === 'scout' ? cfg.MAX_SPEED * 1.25 : (player.variant === 'heavy' ? cfg.MAX_SPEED * 0.8 : cfg.MAX_SPEED);
    if (player.speedBoost > 0) {
      baseMaxSpd *= 1.4;
      player.speedBoost--;
    }
    
    var maxSpd = player.dashTimer > 0 ? cfg.DASH_SPEED + 2 : baseMaxSpd + player.level * 0.08;
    if (speed > maxSpd) {
      player.vx = (player.vx / speed) * maxSpd;
      player.vy = (player.vy / speed) * maxSpd;
    }

    player.x += player.vx;
    player.y += player.vy;

    var pad = 24;
    var max = cfg.MAP_SIZE - pad;
    player.x = Math.max(pad, Math.min(max, player.x));
    player.y = Math.max(pad, Math.min(max, player.y));

    if (player.dashCooldown > 0) player.dashCooldown--;
    player.angle = inp.angle;
  };

  HR.tryDash = function (player, isLocal) {
    if (player.dashCooldown > 0 || player.dashTimer > 0 || !player.input.dash) return false;

    var dir = player.input.angle;
    if (Math.abs(player.vx) + Math.abs(player.vy) > 0.5) {
      dir = Math.atan2(player.vy, player.vx);
    }

    player.dashTimer = HR.CONFIG.DASH_DURATION;
    player.dashCooldown = HR.CONFIG.DASH_COOLDOWN;
    player.vx = Math.cos(dir) * HR.CONFIG.DASH_SPEED;
    player.vy = Math.sin(dir) * HR.CONFIG.DASH_SPEED;

    if (isLocal && HR.audio) HR.audio.dash();
    return true;
  };

  HR.tryShoot = function (state, player, isLocal) {
    if (player.fireCooldown > 0 || !player.input.click) return;

    var fireRate = Math.max(3, 16 - player.level * 1.1);
    player.fireCooldown = fireRate;

    var bSize = 4 + player.level * 0.6;
    var bSpeed = 17 + player.level * 0.45;

    player.vx -= Math.cos(player.angle) * 3.2;
    player.vy -= Math.sin(player.angle) * 3.2;

    state.bullets.push({
      id: player.id + '-' + Date.now() + '-' + Math.random(),
      x: player.x + Math.cos(player.angle) * 32,
      y: player.y + Math.sin(player.angle) * 32,
      vx: Math.cos(player.angle) * bSpeed,
      vy: Math.sin(player.angle) * bSpeed,
      ownerId: player.id,
      size: bSize,
      life: HR.CONFIG.BULLET_LIFE,
      damage: (14 + player.level * 1.4) * (player.variant === 'heavy' ? 1.3 : (player.variant === 'scout' ? 0.8 : 1)),
    });

    if (isLocal && HR.audio) HR.audio.shoot();
  };

  HR.collectGems = function (state, player, onLevelUp, isLocal) {
    for (var i = state.gems.length - 1; i >= 0; i--) {
      var g = state.gems[i];
      if (Math.hypot(player.x - g.x, player.y - g.y) < 34) {
        state.gems.splice(i, 1);
        player.xp += HR.CONFIG.GEM_XP;
        var need = HR.xpNeeded(player.level);
        if (player.xp >= need) {
          player.level++;
          player.xp = 0;
          player.maxHp += 18;
          player.hp = player.maxHp;
          if (isLocal && HR.audio) HR.audio.levelUp();
          if (onLevelUp) onLevelUp(player);
        }
      }
    }
    
    if (state.powerups) {
      for (var i = state.powerups.length - 1; i >= 0; i--) {
        var p = state.powerups[i];
        if (Math.hypot(player.x - p.x, player.y - p.y) < 34) {
          state.powerups.splice(i, 1);
          if (p.type === 'health') {
            player.hp = Math.min(player.hp + 50, player.maxHp);
          } else if (p.type === 'shield') {
            player.shield = 100; // absorbs damage later
          } else if (p.type === 'speed') {
            player.speedBoost = 150; // ticks of speed
          }
          if (isLocal && HR.audio) HR.audio.levelUp(); // re-use sound
        }
      }
    }
  };

  HR.fillWithBots = function (state, count) {
    for (var i = 0; i < count; i++) {
      var botId = 'BOT_' + i + '_' + Date.now().toString(36);
      state.players[botId] = HR.createPlayer(
        botId,
        HR.pick(['Alpha', 'Bravo', 'Delta', 'Echo']) + '-' + HR.pick(['Pilot', 'Ace', 'Ghost']),
        true
      );
    }
  };
})(window.HR);
