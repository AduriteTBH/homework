(function (HR) {
  HR.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  HR.dist = function (x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  };

  HR.clamp = function (v, min, max) {
    return Math.max(min, Math.min(max, v));
  };

  HR.rand = function (min, max) {
    return min + Math.random() * (max - min);
  };

  HR.pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };

  HR.generateRoomCode = function (len, chars) {
    chars = chars || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < len; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  HR.prefs = {
    color: null,
    variant: null,
    callsign: null,
    graphicsMode: 'LOW',
    customGraphics: {
      particles: 1.0,
      dashTrails: 40,
      rotorBlur: true,
      backgroundOrbs: true,
      minimapRate: 1,
      gridPulse: true
    },
    load: function() {
      try {
        var p = JSON.parse(localStorage.getItem('hr_prefs') || '{}');
        this.color = p.color;
        this.variant = p.variant;
        this.callsign = p.callsign;
        this.graphicsMode = p.graphicsMode || 'LOW';
        if (p.customGraphics) {
          Object.assign(this.customGraphics, p.customGraphics);
        }
      } catch(e) {}
    },
    save: function(c, v, n, gm, cg) {
      if(c!==undefined) this.color = c;
      if(v!==undefined) this.variant = v;
      if(n!==undefined) this.callsign = n;
      if(gm!==undefined) this.graphicsMode = gm;
      if(cg!==undefined) this.customGraphics = cg;
      try {
        localStorage.setItem('hr_prefs', JSON.stringify({ 
          color: this.color, variant: this.variant, callsign: this.callsign, 
          graphicsMode: this.graphicsMode, customGraphics: this.customGraphics 
        }));
      } catch(e) {}
    }
  };
  HR.prefs.load();
  HR.myColor = HR.prefs.color;
  HR.myVariant = HR.prefs.variant;
  HR.myCallsign = HR.prefs.callsign;
  if (HR.CONFIG) {
    HR.CONFIG.GRAPHICS_MODE = HR.prefs.graphicsMode;
    HR.CONFIG.CUSTOM_GRAPHICS = HR.prefs.customGraphics;
  }

  HR.stats = {
    wins: 0,
    kills: 0,
    games: 0,
    load: function() {
      try {
        var s = JSON.parse(localStorage.getItem('hr_stats') || '{}');
        this.wins = s.wins || 0;
        this.kills = s.kills || 0;
        this.games = s.games || 0;
      } catch(e) {}
    },
    save: function() {
      try {
        localStorage.setItem('hr_stats', JSON.stringify({ wins: this.wins, kills: this.kills, games: this.games }));
      } catch(e) {}
      if (HR.updateStatsUI) HR.updateStatsUI();
    },
    addWin: function() { this.wins++; this.games++; this.save(); },
    addKill: function() { this.kills++; this.save(); },
    addGame: function() { this.games++; this.save(); }
  };
  HR.stats.load();
})(window.HR);
