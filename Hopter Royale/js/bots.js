(function (HR) {
  var STATES = ['LOOT', 'HUNT', 'FLEE', 'STORM'];

  HR.runBotAI = function (bot, state) {
    bot.input = HR.emptyInput();
    bot.aiState = bot.aiState || 'LOOT';
    bot.aiTimer = (bot.aiTimer || 0) - 1;

    var stormDist = HR.dist(bot.x, bot.y, state.storm.x, state.storm.y);
    var inStorm = stormDist > state.storm.radius;
    var stormMargin = state.storm.radius - 180;

    var threat = null;
    var threatDist = Infinity;
    var loot = null;
    var lootDist = Infinity;

    Object.values(state.players).forEach(function (p) {
      if (p.id === bot.id || !p.alive) return;
      var d = HR.dist(bot.x, bot.y, p.x, p.y);
      if ((p.level > bot.level + 1 && d < 420) || d < 520) {
        if (d < threatDist) {
          threat = p;
          threatDist = d;
        }
      }
    });

    state.crates.forEach(function (c) {
      var d = HR.dist(bot.x, bot.y, c.x, c.y);
      if (d < lootDist) { loot = c; lootDist = d; }
    });

    state.gems.forEach(function (g) {
      var d = HR.dist(bot.x, bot.y, g.x, g.y);
      if (d < lootDist) { loot = g; lootDist = d; }
    });

    if (inStorm || stormDist > stormMargin) {
      bot.aiState = 'STORM';
    } else if (threat && bot.hp < bot.maxHp * 0.35 && threatDist < 380) {
      bot.aiState = 'FLEE';
    } else if (threat && threatDist < 480) {
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
          var t = HR.dist(bot.x, bot.y, threat.x, threat.y) / 18;
          target = {
            x: threat.x + threat.vx * t * 0.6,
            y: threat.y + threat.vy * t * 0.6,
          };
          if (threatDist < 420) bot.input.click = Math.random() > 0.08;
        }
        break;
      case 'LOOT':
        target = loot;
        break;
      default:
        target = {
          x: bot.x + Math.cos(bot.wanderAngle || 0) * 200,
          y: bot.y + Math.sin(bot.wanderAngle || 0) * 200,
        };
    }

    if (target) steerBot(bot, target, bot.aiState === 'HUNT');

    if ((bot.aiState === 'FLEE' || bot.aiState === 'HUNT') && bot.dashCooldown <= 0 && Math.random() > 0.85) {
      if (bot.aiState === 'FLEE' || threatDist < 300) {
        bot.input.dash = true;
      }
    }
    if (bot.aiState === 'LOOT' && lootDist > 200 && bot.dashCooldown <= 0 && Math.random() > 0.95) {
      bot.input.dash = true;
    }
  };

  function steerBot(bot, target, strafe) {
    var angle = Math.atan2(target.y - bot.y, target.x - bot.x);
    bot.input.angle = angle;
    var perp = angle + Math.PI / 2;

    if (strafe) {
      // Strafe to dodge bullets (simulated by random strafe switching)
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
