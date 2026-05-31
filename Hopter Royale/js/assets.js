(function (HR) {
  var ASSET_PATHS = {
    logo: 'assets/logo.svg',
    logoPng: 'assets/logo.png',
    hopterBase: 'assets/sprites/hopter-base.png',
    hopterScout: 'assets/sprites/hopter-scout.png',
    hopterHeavy: 'assets/sprites/hopter-heavy.png',
    groundTile: 'assets/textures/ground-tile.png',
    crate: 'assets/textures/crate.png',
    crateGold: 'assets/textures/crate-gold.png',
    powerupHealth: 'assets/textures/powerup-health.png',
    powerupShield: 'assets/textures/powerup-shield.png',
    powerupSpeed: 'assets/textures/powerup-speed.png',
    gem: 'assets/textures/gem.png',
    gemSvg: 'assets/textures/gem.svg',
    bullet: 'https://raw.githubusercontent.com/KenneyNL/Space-Shooter-Redux/master/PNG/Lasers/laserBlue01.png',
    bulletSvg: 'https://raw.githubusercontent.com/KenneyNL/Space-Shooter-Redux/master/PNG/Lasers/laserBlue01.png',
    menuMusic: 'assets/audio/menu.mp3',
    menuMusicOgg: 'assets/audio/menu.ogg',
    battleMusic: 'assets/audio/battle.wav',
    battleMusicOgg: 'assets/audio/battle.ogg',
    sfxLaser: 'assets/audio/laser.ogg',
    sfxHit: 'assets/audio/hit.ogg',
    sfxPowerup: 'assets/audio/powerup.ogg',
    sfxSelect: 'assets/audio/select.ogg',
  };

  var images = {};
  var tintCache = {};
  var ready = false;
  var loadPromise = null;

  function loadImage(key, src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        images[key] = img;
        resolve(true);
      };
      img.onerror = function () { resolve(false); };
      img.src = src;
    });
  }

  function loadSvgAsImage(key, src) {
    return loadImage(key, src);
  }

  function tryLoad(key, paths) {
    var list = Array.isArray(paths) ? paths : [paths];
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(false);
      var src = list[i++];
      if (src.slice(-4) === '.svg') {
        return loadSvgAsImage(key, src).then(function (ok) { return ok || next(); });
      }
      return loadImage(key, src).then(function (ok) { return ok || next(); });
    }
    return next();
  }

  HR.assets = {
    paths: ASSET_PATHS,
    images: images,
    isReady: function () { return ready; },

    load: function () {
      if (loadPromise) return loadPromise;
      loadPromise = Promise.all([
        tryLoad('logo', [ASSET_PATHS.logo, ASSET_PATHS.logoPng]),
        loadImage('hopterBase', ASSET_PATHS.hopterBase),
        loadImage('hopterScout', ASSET_PATHS.hopterScout),
        loadImage('hopterHeavy', ASSET_PATHS.hopterHeavy),
        loadImage('groundTile', ASSET_PATHS.groundTile),
        loadImage('crate', ASSET_PATHS.crate),
        loadImage('crateGold', ASSET_PATHS.crateGold),
        loadImage('powerupHealth', ASSET_PATHS.powerupHealth),
        loadImage('powerupShield', ASSET_PATHS.powerupShield),
        loadImage('powerupSpeed', ASSET_PATHS.powerupSpeed),
        tryLoad('gem', [ASSET_PATHS.gem, ASSET_PATHS.gemSvg]),
        tryLoad('bullet', [ASSET_PATHS.bullet, ASSET_PATHS.bulletSvg]),
      ]).then(function () {
        ready = true;
        return images;
      });
      return loadPromise;
    },

    get: function (key) { return images[key] || null; },

    drawHopter: function (ctx, size, color, rotor, ghost, variant) {
      var key = 'hopter' + (variant ? variant.charAt(0).toUpperCase() + variant.slice(1) : 'Base');
      var img = images[key] || images.hopterBase;
      if (!img) return false;

      var w = img.naturalWidth || img.width || 128;
      var h = img.naturalHeight || img.height || 128;
      var scale = (size * 2.15) / Math.max(w, h);
      
      var cacheKey = key + '_' + (color || 'none');
      if (!tintCache[cacheKey]) {
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        var tCtx = c.getContext('2d');
        tCtx.drawImage(img, 0, 0, w, h);
        
        if (color) {
          tCtx.globalCompositeOperation = 'source-atop';
          tCtx.fillStyle = color;
          tCtx.fillRect(0, 0, w, h);
          
          tCtx.globalCompositeOperation = 'multiply';
          tCtx.drawImage(img, 0, 0, w, h);
          tCtx.globalCompositeOperation = 'source-over';
        }
        tintCache[cacheKey] = c;
      }

      ctx.save();
      if (ghost) ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.42;

      ctx.drawImage(tintCache[cacheKey], -w * scale / 2, -h * scale / 2, w * scale, h * scale);

      ctx.restore();
      return true;
    },
  };

  HR.assets.load();
})(window.HR);
