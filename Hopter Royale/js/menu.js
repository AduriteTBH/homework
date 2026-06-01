(function (HR) {
  var canvases = [];
  var animId = null;
  var hopters = [];
  var sceneReady = false;

  HR.initMenuScene = function (force) {
    if (sceneReady && !force) return;

    canvases = [];
    document.querySelectorAll('.menu-bg-canvas').forEach(function (el) {
      var c = { el: el, ctx: el.getContext('2d') };
      canvases.push(c);
    });

    if (!canvases.length) return;

    resizeAll();
    window.addEventListener('resize', resizeAll);

    hopters = [];
    var w = canvases[0].el.width || window.innerWidth;
    var h = canvases[0].el.height || window.innerHeight;
    for (var i = 0; i < 8; i++) {
      hopters.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.35,
        r: 16 + Math.random() * 12,
        rotor: Math.random() * Math.PI * 2,
        color: HR.PLAYER_COLORS[i % HR.PLAYER_COLORS.length],
        phase: Math.random() * Math.PI * 2,
      });
    }

    if (animId) cancelAnimationFrame(animId);
    sceneReady = true;

    function loop() {
      var menuVisible = !document.getElementById('menu-screen').classList.contains('hidden');
      var lobbyVisible = !document.getElementById('lobby-screen').classList.contains('hidden');
      if (!menuVisible && !lobbyVisible) {
        animId = requestAnimationFrame(loop);
        return;
      }
      drawAllBg();
      drawPreview();
      animId = requestAnimationFrame(loop);
    }
    loop();
  };

  function resizeAll() {
    canvases.forEach(function (c) {
      c.el.width = window.innerWidth;
      c.el.height = window.innerHeight;
    });
  }

  function drawHopterSilhouette(ctx, x, y, r, color, rotor, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha || 0.35;

    if (HR.assets && HR.assets.drawHopter) {
      ctx.rotate(rotor * 0.08);
      HR.assets.drawHopter(ctx, r, color, rotor, false);
      ctx.restore();
      return;
    }

    var grad = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.3);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPreview() {
    var c = document.getElementById('preview-canvas');
    if(!c) return;
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    
    if (HR.assets && HR.assets.drawHopter) {
      ctx.save();
      ctx.translate(w/2, h/2);
      var t = Date.now() / 1000;
      var hoverY = Math.sin(t * 2) * 5;
      ctx.translate(0, hoverY);
      
      var rotor = t * 12;
      var color = HR.myColor || '#3498db';
      var variant = HR.myVariant || 'base';
      
      // Draw shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 40 - hoverY, 30 + hoverY*2, 15 + hoverY, 0, 0, Math.PI*2);
      ctx.fill();
      
      HR.assets.drawHopter(ctx, 45, color, rotor, false, variant);
      ctx.restore();
    }
  }

  function drawAllBg() {
    var t = Date.now() / 1000;
    canvases.forEach(function (c) {
      var ctx = c.ctx;
      var w = c.el.width;
      var h = c.el.height;
      if (!ctx || w <= 0) return;

      var g = ctx.createLinearGradient(0, 0, w * 0.8, h);
      g.addColorStop(0, '#1c293e');
      g.addColorStop(0.5, '#121a28');
      g.addColorStop(1, '#080c14');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(94, 207, 255, 0.03)';
      for (var i = 0; i < 24; i++) {
        var px = (Math.sin(t * 0.2 + i) * 0.5 + 0.5) * w;
        var py = ((i * 97) % h);
        ctx.fillRect(px, py, 1, 1);
      }

      hopters.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy + Math.sin(t + p.phase) * 0.08;
        p.rotor += 0.12;
        if (p.x < -60) p.x = w + 60;
        if (p.x > w + 60) p.x = -60;
        if (p.y < -60) p.y = h + 60;
        if (p.y > h + 60) p.y = -60;
        drawHopterSilhouette(ctx, p.x, p.y, p.r, p.color, p.rotor, 0.32);
      });

      var vg = ctx.createRadialGradient(w * 0.28, h * 0.5, h * 0.15, w * 0.5, h * 0.5, h * 0.95);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.82)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    });
  }
})(window.HR);
