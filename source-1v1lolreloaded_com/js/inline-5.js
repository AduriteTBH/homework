
    var gameInstance = UnityLoader.instantiate("gameContainer", "build.json?v=acc67798", {
      onProgress: function(instance, p) {
        var pct = Math.round(p * 100);
        var bar = document.getElementById('loading-bar-fill');
        var s = document.getElementById('progress-status');
        if (bar) bar.style.width = pct + '%';
        if (s) s.textContent = String(pct).padStart(3, '0') + '%';
      },
      Module: { onRuntimeInitialized: function() {
        var el = document.getElementById('progress-wrap');
        if (el) {
          el.style.transition = 'opacity .35s ease';
          el.style.opacity = '0';
          setTimeout(function() { el.style.display = 'none'; }, 380);
        }
      }}
    });
  