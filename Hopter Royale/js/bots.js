(function (HR) {
  var STATES = ['LOOT', 'HUNT', 'FLEE', 'STORM'];

  function distSq(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  HR.runBotAI = function (bot, state) {
    bot.input = HR.emptyInput();
    bot.aiState = bot.aiState || 'LOOT';
    bot.aiTimer = (bot.aiTimer || 0) - 1;

    var stormDistSq = distSq(bot.x, bot.y, state.storm.x, state.storm.y);
    var stormRadSq = state.storm.radius * state.storm.radius;
    var inStorm = stormDistSq > stormRadSq;
    var stormMargin = state.storm.radius - 180;
    var stormMarginSq = stormMargin * stormMargin;

    var threat = null;
    var threatDistSq = Infinity;
    var loot = null;
    var lootDistSq = Infinity;

    Object.values(state.players).forEach(function (p) {
      if (p.id === bot.id || !p.alive) return;
      var dSq = distSq(bot.x, bot.y, p.x, p.y);
      var aggroRange = p.isBot ? 380 : 520;
      var aggroShort = aggroRange - 100;
      if ((p.level > bot.level + 1 && dSq < aggroShort * aggroShort) || dSq < aggroRange * aggroRange) {
        if (dSq < threatDistSq) {
          threat = p;
          threatDistSq = dSq;
        }
      }
    });

    state.crates.forEach(function (c) {
      var dSq = distSq(bot.x, bot.y, c.x, c.y);
      if (dSq < lootDistSq) { loot = c; lootDistSq = dSq; }
    });

    state.gems.forEach(function (g) {
      var dSq = distSq(bot.x, bot.y, g.x, g.y);
      if (dSq < lootDistSq) { loot = g; lootDistSq = dSq; }
    });

    var inGracePeriod = state.matchStartTime && Date.now() < state.matchStartTime + 2000;
    if (inGracePeriod) {
      threat = null;
    }

    if (inStorm || stormDistSq > stormMarginSq) {
      bot.aiState = 'STORM';
    } else if (threat && bot.hp < bot.maxHp * 0.35 && threatDistSq < 380 * 380) {
      bot.aiState = 'FLEE';
    } else if (threat && threatDistSq < 480 * 480) {
      bot.aiState = 'HUNT';
    } else if (loot) {
      bot.aiState = 'LOOT';
    } else if (bot.aiTimer <= 0) {
      bot.aiState = STATES[Math.floor(Math.random() * STATES.length)];
      bot.aiTimer = 90 + Math.random() * 120;
      bot.wanderAngle = Math.random() * Math.PI * 2;
    }

    var target = null;

    switch (bot.aiState) {
      case 'STORM':
        target = { x: state.storm.x, y: state.storm.y };
        break;
      case 'FLEE':
        if (threat) {
          var away = Math.atan2(bot.y - threat.y, bot.x - threat.x);
          target = {
            x: bot.x + Math.cos(away) * 300,
            y: bot.y + Math.sin(away) * 300,
          };
        }
        break;
      case 'HUNT':
        if (threat) {
          var t = Math.sqrt(threatDistSq) / 18;
          target = {
            x: threat.x + threat.vx * t * 0.6,
            y: threat.y + threat.vy * t * 0.6,
          };
          var fireChance = threat.isBot ? 0.3 : 0.6;
          if (threatDistSq < 420 * 420) bot.input.click = Math.random() > fireChance;
        }
        break;
      case 'LOOT':
        target = loot;
        if (lootDistSq < 250 * 250) bot.input.click = Math.random() > 0.05;
        break;
      default:
        target = {
          x: bot.x + Math.cos(bot.wanderAngle || 0) * 200,
          y: bot.y + Math.sin(bot.wanderAngle || 0) * 200,
        };
    }

    if (target) steerBot(bot, target, bot.aiState === 'HUNT');

    if (bot.aiState === 'HUNT' && threat) {
      var aimJitter = threat.isBot ? 0.2 : 0.55;
      bot.input.angle += (Math.random() - 0.5) * aimJitter;
    }

    if ((bot.aiState === 'FLEE' || bot.aiState === 'HUNT') && bot.dashCooldown <= 0 && Math.random() > 0.85) {
      if (bot.aiState === 'FLEE' || threatDistSq < 300 * 300) {
        bot.input.dash = true;
      }
    }
    if (bot.aiState === 'LOOT' && lootDistSq > 200 * 200 && bot.dashCooldown <= 0 && Math.random() > 0.95) {
      bot.input.dash = true;
    }

    var blockingCrate = null;
    state.crates.forEach(function (c) {
      if (distSq(bot.x, bot.y, c.x, c.y) < 70 * 70) {
        blockingCrate = c;
      }
    });

    if (blockingCrate) {
      bot.input.angle = Math.atan2(blockingCrate.y - bot.y, blockingCrate.x - bot.x);
      bot.input.click = true;
    }
  };

  function steerBot(bot, target, strafe) {
    var angle = Math.atan2(target.y - bot.y, target.x - bot.x);
    bot.input.angle = angle;
    var perp = angle + Math.PI / 2;

    if (strafe) {
      if (Math.random() > 0.96) bot.strafeDir = (bot.strafeDir || 1) * -1;
      var sd = bot.strafeDir || 1;
      bot.input[Math.cos(perp) * sd > 0 ? 'd' : 'a'] = true;
      bot.input[Math.sin(perp) * sd > 0 ? 's' : 'w'] = true;
      bot.input[Math.cos(angle) > 0.1 ? 'd' : 'a'] = Math.abs(Math.cos(angle)) > 0.1;
      bot.input[Math.sin(angle) > 0.1 ? 's' : 'w'] = Math.abs(Math.sin(angle)) > 0.1;
    } else {
      if (Math.abs(Math.cos(angle)) > 0.2) bot.input[Math.cos(angle) > 0 ? 'd' : 'a'] = true;
      if (Math.abs(Math.sin(angle)) > 0.2) bot.input[Math.sin(angle) > 0 ? 's' : 'w'] = true;
    }
  }
})(window.HR);