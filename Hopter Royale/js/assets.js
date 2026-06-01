(function (HR) {
  var ASSET_PATHS = {
    logo: 'assets/logo.svg',
    logoPng: 'assets/logo.png',
    hopterBase: 'assets/sprites/hopter-base-v3.png',
    hopterScout: 'assets/sprites/hopter-scout-v3.png',
    hopterHeavy: 'assets/sprites/hopter-heavy-v3.png',
    hopterPhantom: 'assets/sprites/hopter-phantom-v3.png',
    hopterSpectre: 'assets/sprites/hopter-spectre-v3.png',
    hopterApache: 'assets/sprites/hopter-apache-v3.png',
    hopterViper: 'assets/sprites/hopter-viper-v3.png',
    hopterGoliath: 'assets/sprites/hopter-goliath-v3.png',
    hopterWraith: 'assets/sprites/hopter-wraith-v3.png',
    hopterTitan: 'assets/sprites/hopter-titan-v3.png',
    groundTile: 'assets/textures/ground-tile.png',
    crate: 'assets/textures/crate.png',
    crateGold: 'assets/textures/crate-gold.png',
    powerupHealth: 'assets/textures/powerup-health.png',
    powerupShield: 'assets/textures/powerup-shield.png',
    powerupSpeed: 'assets/textures/powerup-speed.png',
    gem: 'assets/textures/gem.svg',
    gemSvg: 'assets/textures/gem.svg',
    bullet: 'assets/textures/laserYellow.png',
    bulletSvg: 'assets/textures/laserYellow.png',
    menuMusic: 'assets/audio/menu.wav',
    menuMusicOgg: '', // File missing
    battleMusic: 'assets/audio/battle.wav',
    battleMusicOgg: '', // File missing
    sfxLaser: 'assets/audio/laser.mp3',
    sfxHit: 'assets/audio/hit.mp3',
    sfxPowerup: 'assets/audio/powerup.mp3',
    sfxSelect: 'assets/audio/select.mp3',
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
        loadImage('hopterPhantom', ASSET_PATHS.hopterPhantom),
        loadImage('hopterSpectre', ASSET_PATHS.hopterSpectre),
        loadImage('hopterApache', ASSET_PATHS.hopterApache),
        loadImage('hopterViper', ASSET_PATHS.hopterViper),
        loadImage('hopterGoliath', ASSET_PATHS.hopterGoliath),
        loadImage('hopterWraith', ASSET_PATHS.hopterWraith),
        loadImage('hopterTitan', ASSET_PATHS.hopterTitan),
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
      var scale = (size * 2.8) / Math.max(w, h);
      
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
