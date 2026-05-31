(function (HR) {
  var particles = [];
  var dashTrails = [];
  var rotorPhase = 0;
  var screenShake = 0;
  var floatingTexts = [];

  HR.addFloatingText = function(x, y, text, color) {
    floatingTexts.push({ x: x, y: y, text: text, color: color, life: 1, vy: -1.5 });
  };

  HR.spawnParticles = function (x, y, color, count) {
    count = count || 18;
    for (var i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 1,
        color: color,
        size: Math.random() * 5 + 2,
      });
    }
  };

  HR.addScreenShake = function (amt) {
    screenShake = Math.max(screenShake, amt || 4);
  };

  HR.createRenderer = function (canvas, minimapCanvas) {
    var ctx = canvas.getContext('2d');
    var mmCtx = minimapCanvas.getContext('2d');
    var renderPlayers = {};
    var camX = 0;
    var camY = 0;
    var lastFrame = performance.now();
    var cachedOrbCanvas = null;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      var mmSize = Math.max(100, Math.min(160, Math.min(canvas.width, canvas.height) * 0.18));
      minimapCanvas.width = mmSize;
      minimapCanvas.height = mmSize;
      document.getElementById('minimap-container').style.width = mmSize + 'px';
      document.getElementById('minimap-container').style.height = mmSize + 'px';
    }

    resize();
    window.addEventListener('resize', resize);

    function syncPlayers(statePlayers, myId) {
      Object.values(statePlayers).forEach(function (p) {
        if (renderPlayers[p.id]) {
          var rp = renderPlayers[p.id];
          if (rp.hp > p.hp && rp.alive) {
            var diff = Math.round(rp.hp - p.hp);
            if (diff > 0) HR.addFloatingText(p.x, p.y - 30, '-' + diff, '#ff6b6b');
            if (p.id === myId) HR.addScreenShake(diff * 0.4);
          }
        }
        if (!renderPlayers[p.id]) {
          renderPlayers[p.id] = Object.assign({}, p, { x: p.x, y: p.y, rotor: Math.random() * Math.PI * 2 });
        }
        var rp = renderPlayers[p.id];
        rp.targetX = p.x;
        rp.targetY = p.y;
        rp.angle = p.angle;
        rp.hp = p.hp;
        rp.maxHp = p.maxHp;
        rp.level = p.level;
        rp.xp = p.xp;
        rp.alive = p.alive;
        rp.name = p.name;
        rp.color = p.color;
        rp.variant = p.variant || 'base';
        rp.shield = p.shield || 0;
        rp.speedBoost = p.speedBoost || 0;
        rp.kills = p.kills;
        rp.dashTimer = p.dashTimer || 0;
        rp.dashCooldown = p.dashCooldown || 0;
        rp.vx = p.vx;
        rp.vy = p.vy;
      });
    }

    function render(state, myId) {
      var now = performance.now();
      var dt = Math.min(32, now - lastFrame) / 16.67;
      lastFrame = now;
      rotorPhase += 0.45 * dt;

      var me = renderPlayers[myId];
      if (!me) return null;

      if (me.alive) {
        camX = HR.lerp(camX, me.x - canvas.width / 2, 0.12);
        camY = HR.lerp(camY, me.y - canvas.height / 2, 0.12);
      }

      var shakeX = 0;
      var shakeY = 0;
      if (screenShake > 0.1) {
        shakeX = (Math.random() - 0.5) * screenShake;
        shakeY = (Math.random() - 0.5) * screenShake;
        screenShake *= 0.82;
      }

      drawBackground(ctx, camX + shakeX, camY + shakeY);
      
      ctx.save();
      ctx.translate(-camX + shakeX, -camY + shakeY);
      drawGrid(ctx);
      
      drawCrates(ctx, state.crates);
      
      if (state.powerups) drawPowerups(ctx, state.powerups);
      drawGems(ctx, state.gems);
      drawStorm(ctx, state.storm);
      drawDashTrails(ctx);
      drawBullets(ctx, state.bullets);
      drawParticles(ctx);
      drawPlayers(ctx, renderPlayers, myId, dt);
      drawFloatingTexts(ctx);
      ctx.restore();
      drawIndicators(ctx, state, me);
      drawMinimap(mmCtx, minimapCanvas, state, me);
      return me;
    }

    return { render: render, syncPlayers: syncPlayers };
  };

  function drawIndicators(ctx, state, me) {
    if (!me || !me.alive) return;
    
    var nearest = null;
    var minDist = Infinity;
    state.crates.forEach(function(c) {
      var d = Math.hypot(c.x - me.x, c.y - me.y);
      if (d < minDist && d > Math.max(ctx.canvas.width, ctx.canvas.height) * 0.4) { 
        minDist = d; nearest = c; 
      }
    });
    
    if (nearest) {
      var angle = Math.atan2(nearest.y - me.y, nearest.x - me.x);
      var pad = 40;
      var w = ctx.canvas.width;
      var h = ctx.canvas.height;
      
      var distToEdgeX = w/2 - pad;
      var distToEdgeY = h/2 - pad;
      var cos = Math.cos(angle), sin = Math.sin(angle);
      
      var tX = cos !== 0 ? Math.abs(distToEdgeX / cos) : Infinity;
      var tY = sin !== 0 ? Math.abs(distToEdgeY / sin) : Infinity;
      var t = Math.min(tX, tY);
      
      var ix = w/2 + cos * t;
      var iy = h/2 + sin * t;
      
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(angle);
      
      ctx.fillStyle = 'rgba(156, 136, 255, 0.8)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#9c88ff';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, 8);
      ctx.lineTo(-8, -8);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CRATE', -20, 3);
      
      ctx.restore();
    }
  }

  function drawBackground(ctx, camX, camY) {
    // Vibrant Neon Map Background
    var t = Date.now() / 1000;
    
    // Gradient base
    var g = ctx.createLinearGradient(0, 0, ctx.canvas.width, ctx.canvas.height);
    g.addColorStop(0, '#0a0b1a');
    g.addColorStop(1, '#1a1025');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Dynamic glowing orbs (Optimized with cached pre-render)
    if (!HR.cachedOrbCanvas) {
       var oc = document.createElement('canvas');
       oc.width = 500; oc.height = 500;
       var oCtx = oc.getContext('2d');
       var rGrad = oCtx.createRadialGradient(250, 250, 0, 250, 250, 250);
       rGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
       rGrad.addColorStop(1, 'transparent');
       oCtx.fillStyle = rGrad;
       oCtx.fillRect(0, 0, 500, 500);
       HR.cachedOrbCanvas = oc;
    }

    ctx.globalCompositeOperation = 'screen';
    var numOrbs = 5;
    for (var i = 0; i < numOrbs; i++) {
       var ox = (Math.sin(t * 0.5 + i) * 300 + camX * 0.1 * (i%2 ? 1 : -1)) % ctx.canvas.width;
       var oy = (Math.cos(t * 0.4 + i*2) * 300 + camY * 0.1 * (i%3 ? 1 : -1)) % ctx.canvas.height;
       if (ox < 0) ox += ctx.canvas.width;
       if (oy < 0) oy += ctx.canvas.height;
       
       var rad = 200 + Math.sin(t + i)*50;
       ctx.save();
       ctx.translate(ox, oy);
       ctx.scale(rad/250, rad/250);
       // tinting the cached orb using globalAlpha and colored overlay is faster than recreating gradients
       ctx.globalAlpha = 0.8;
       ctx.drawImage(HR.cachedOrbCanvas, -250, -250);
       ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw the tile slightly blended if it exists
    var tile = HR.assets && HR.assets.get('groundTile');
    if (tile) {
      ctx.globalAlpha = 0.4; // make it less opaque to let colors through
      var ts = 128;
      var cx = -(camX % ts);
      var cy = -(camY % ts);
      for (var y = cy; y < ctx.canvas.height + ts; y += ts) {
        for (var x = cx; x < ctx.canvas.width + ts; x += ts) {
          ctx.drawImage(tile, x, y, ts, ts);
        }
      }
      ctx.globalAlpha = 1.0;
    }
  }

  function drawGrid(ctx) {
    var t = Date.now() / 800;
    ctx.strokeStyle = 'rgba(0, 210, 211, 0.15)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= HR.CONFIG.MAP_SIZE; i += 120) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, HR.CONFIG.MAP_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(HR.CONFIG.MAP_SIZE, i);
      ctx.stroke();
    }
    
    // Inner pulse
    ctx.strokeStyle = 'rgba(0, 210, 211, ' + (0.3 + Math.sin(t)*0.2) + ')';
    ctx.lineWidth = 2;
    for (var i = 0; i <= HR.CONFIG.MAP_SIZE; i += 480) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, HR.CONFIG.MAP_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(HR.CONFIG.MAP_SIZE, i);
      ctx.stroke();
    }

    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, HR.CONFIG.MAP_SIZE, HR.CONFIG.MAP_SIZE);
  }

  function drawCrates(ctx, crates) {
    crates.forEach(function (c, i) {
      var size = c.type === 'gold' ? 24 : 20;
      var t = Date.now() / 500 + i;
      var hoverScale = 1 + Math.sin(t) * 0.05; 
      var baseColor = c.type === 'gold' ? '#fbc531' : '#9c88ff';
      var innerColor = c.type === 'gold' ? '#ffeaa7' : '#a29bfe';
      
      ctx.save();
      ctx.translate(c.x, c.y);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.fillRect(-size*0.8, -size*0.8, size*1.6, size*1.6);
      
      ctx.scale(hoverScale, hoverScale);
      
      // Base Box (Top Down)
      ctx.shadowBlur = 15;
      ctx.shadowColor = baseColor;
      ctx.fillStyle = '#2f3640';
      ctx.fillRect(-size, -size, size * 2, size * 2);
      
      // Border
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      
      // Inner tech lines
      ctx.strokeStyle = innerColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(-size + 6, -size + 6, size * 2 - 12, size * 2 - 12);
      
      // Center glow
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
  }

  function drawGems(ctx, gems) {
    var gemImg = HR.assets && HR.assets.get('gem');
    var t = Date.now() / 400;
    gems.forEach(function (g, i) {
      var bob = Math.sin(t + i) * 3;
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      if (gemImg) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00d2ff';
        ctx.drawImage(gemImg, -12, -12, 24, 24);
      } else {
        ctx.fillStyle = '#00d2ff';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#00d2ff';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(8, 0);
        ctx.lineTo(0, 10);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawPowerups(ctx, powerups) {
    powerups.forEach(function (p, i) {
      var t = Date.now() / 400;
      var bob = Math.sin(t + i) * 3;
      var key = 'powerup' + p.type.charAt(0).toUpperCase() + p.type.slice(1);
      var img = HR.assets && HR.assets.get(key);
      
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      if (img) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.type === 'health' ? '#2ecc71' : (p.type === 'shield' ? '#3498db' : '#f1c40f');
        ctx.drawImage(img, -14, -14, 28, 28);
      } else {
        ctx.fillStyle = p.type === 'health' ? '#2ecc71' : (p.type === 'shield' ? '#3498db' : '#f1c40f');
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawStorm(ctx, storm) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 60, 40, 0.14)';
    ctx.beginPath();
    ctx.rect(-500, -500, HR.CONFIG.MAP_SIZE + 1000, HR.CONFIG.MAP_SIZE + 1000);
    ctx.arc(storm.x, storm.y, storm.radius, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 8;
    ctx.setLineDash([20, 12]);
    ctx.beginPath();
    ctx.arc(storm.x, storm.y, storm.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawBullets(ctx, bullets) {
    var bulletImg = HR.assets && HR.assets.get('bullet');
    bullets.forEach(function (b) {
      ctx.save();
      if (bulletImg) {
        ctx.translate(b.x, b.y);
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fbc531';
        ctx.drawImage(bulletImg, -b.size, -b.size, b.size * 2, b.size * 2);
      } else {
        ctx.fillStyle = '#ffe066';
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#fbc531';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawParticles(ctx) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawFloatingTexts(ctx) {
    for (var i = floatingTexts.length - 1; i >= 0; i--) {
      var ft = floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= 0.02;
      if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }
      ctx.globalAlpha = ft.life;
      ctx.fillStyle = ft.color || '#fff';
      ctx.font = '800 20px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#000';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  function drawDashTrails(ctx) {
    for (var i = dashTrails.length - 1; i >= 0; i--) {
      var t = dashTrails[i];
      t.life -= 0.08;
      if (t.life <= 0) { dashTrails.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = t.life;
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      
      var gradient = ctx.createLinearGradient(0, 0, -t.r * 2.5, 0);
      gradient.addColorStop(0, t.color);
      gradient.addColorStop(1, 'transparent');
      
      // Disabled shadow blur here to massively improve Chromebook FPS during dashing
      ctx.fillStyle = gradient;
      
      ctx.beginPath();
      ctx.ellipse(-t.r * 1.2, 0, t.r * 1.8, t.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }

  function drawPlayers(ctx, players, myId, dt) {
    var lerpFactor = 1 - Math.pow(1 - 0.35, dt);
    
    Object.values(players).forEach(function (p) {
      if (!p.alive) return;

      p.x = HR.lerp(p.x, p.targetX != null ? p.targetX : p.x, lerpFactor);
      p.y = HR.lerp(p.y, p.targetY != null ? p.targetY : p.y, lerpFactor);
      p.rotor = (p.rotor || 0) + (0.55 + p.level * 0.02) * dt;

      var r = 22 + p.level * 0.45;
      var dashing = (p.dashTimer || 0) > 0;

      if (dashing) {
        dashTrails.push({
          x: p.x, y: p.y, angle: p.angle, r: r, color: p.color,
          rotor: p.rotor, life: 0.7, variant: p.variant
        });
        if (dashTrails.length > 40) dashTrails.shift();
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (dashing) {
        ctx.shadowBlur = 22;
        ctx.shadowColor = p.color;
      }

      if (!HR.assets || !HR.assets.drawHopter(ctx, r, p.color, p.rotor, false, p.variant)) {
        drawHopterBody(ctx, r, p.color, p.rotor, false);
      }

      ctx.shadowBlur = 0;
      ctx.restore();
      
      if (dashing && p.id === myId) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        for (var i = 0; i < 20; i++) {
           var angle = Math.random() * Math.PI * 2;
           var dist = 80 + Math.random() * 100;
           var len = 100 + Math.random() * 200;
           ctx.beginPath();
           ctx.moveTo(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist);
           ctx.lineTo(p.x + Math.cos(angle) * (dist + len), p.y + Math.sin(angle) * (dist + len));
           ctx.stroke();
        }
        ctx.restore();
      }

      var nameY = p.y - r - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(p.x - 36, nameY - 10, 72, 14);
      ctx.fillStyle = '#fff';
      ctx.font = '600 clamp(10px, 2vw, 13px) Outfit, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name + ' · Lv' + p.level, p.x, nameY);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x - 24, p.y + r + 8, 48, 6);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(p.x - 24, p.y + r + 8, 48 * (p.hp / p.maxHp), 6);
      
      if (p.shield > 0) {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(p.x - 24, p.y + r + 14, 48 * (p.shield / 100), 4);
      }
    });
  }

  function drawHopterBody(ctx, r, color, rotor, ghost) {
    var hub = r * 0.35;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-r - 20, -5, 24, 10);

    ctx.fillStyle = '#8899aa';
    ctx.fillRect(r - 2, -5, 18, 10);
    ctx.fillStyle = '#667788';
    ctx.fillRect(r + 14, -3, 8, 6);

    var grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, lighten(color, 45));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, darken(color, 30));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.2, r * 0.35, r * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    if (!ghost) {
      ctx.fillStyle = 'rgba(0,210,255,0.25)';
      ctx.beginPath();
      ctx.arc(-r * 0.1, 0, hub, 0, Math.PI * 2);
      ctx.fill();
      
      // Dynamic Glowing Thruster Effect
      var thrusterLen = 14 + Math.random() * 8;
      ctx.fillStyle = 'rgba(0, 210, 255, 0.8)';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00d2ff';
      ctx.beginPath();
      ctx.moveTo(-r - 18, -3);
      ctx.lineTo(-r - 18 - thrusterLen, 0);
      ctx.lineTo(-r - 18, 3);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    drawRotorBlur(ctx, r, rotor, ghost);
  }

  function drawRotorBlur(ctx, r, rotor, ghost) {
    var bladeLen = r * 2.15;

    ctx.save();
    ctx.rotate(rotor);

    ctx.strokeStyle = ghost ? 'rgba(200,220,255,0.15)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, r * 0.09, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ghost ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.92)';
    ctx.lineWidth = ghost ? 2 : 3.5;
    ctx.lineCap = 'round';
    for (var b = 0; b < 2; b++) {
      ctx.save();
      ctx.rotate(Math.PI * b);
      ctx.beginPath();
      ctx.moveTo(-bladeLen * 0.46, 0);
      ctx.lineTo(bladeLen * 0.46, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-r - 18, 0);
    ctx.rotate(rotor * 3);
    ctx.strokeStyle = 'rgba(180,200,220,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawMinimap(mmCtx, canvas, state, me) {
    var scale = canvas.width / HR.CONFIG.MAP_SIZE;
    mmCtx.clearRect(0, 0, canvas.width, canvas.height);

    mmCtx.fillStyle = 'rgba(6,9,14,0.95)';
    mmCtx.fillRect(0, 0, canvas.width, canvas.height);

    mmCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    mmCtx.lineWidth = 1;
    mmCtx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    mmCtx.fillStyle = 'rgba(255, 70, 50, 0.25)';
    mmCtx.beginPath();
    mmCtx.arc(state.storm.x * scale, state.storm.y * scale, state.storm.radius * scale, 0, Math.PI * 2);
    mmCtx.fill();
    mmCtx.strokeStyle = 'rgba(255,80,60,0.6)';
    mmCtx.lineWidth = 1.5;
    mmCtx.stroke();

    mmCtx.fillStyle = 'rgba(156,136,255,0.55)';
    state.crates.forEach(function (c) {
      mmCtx.fillRect(c.x * scale - 1, c.y * scale - 1, 2, 2);
    });

    Object.values(state.players).forEach(function (p) {
      if (!p.alive) return;
      var isMe = p.id === me.id;
      mmCtx.fillStyle = isMe ? '#4cd137' : (p.isBot ? '#e1b12c' : '#54a0ff');
      mmCtx.beginPath();
      mmCtx.arc(p.x * scale, p.y * scale, isMe ? 4 : 2.5, 0, Math.PI * 2);
      mmCtx.fill();
      if (isMe) {
        mmCtx.strokeStyle = 'rgba(255,255,255,0.8)';
        mmCtx.lineWidth = 1;
        mmCtx.stroke();
      }
    });
  }

  function lighten(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgb(' +
      Math.min(255, ((n >> 16) & 255) + amt) + ',' +
      Math.min(255, ((n >> 8) & 255) + amt) + ',' +
      Math.min(255, (n & 255) + amt) + ')';
  }

  function darken(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgb(' +
      Math.max(0, ((n >> 16) & 255) - amt) + ',' +
      Math.max(0, ((n >> 8) & 255) - amt) + ',' +
      Math.max(0, (n & 255) - amt) + ')';
  }
})(window.HR);
