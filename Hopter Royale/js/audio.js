(function (HR) {
  var ctx = null;
  var muted = false;
  var musicGain = null;
  var sfxGain = null;
  var masterGain = null;
  var musicTimer = null;
  var musicStep = 0;
  var inBattle = false;
  var audioBuffers = { menu: null, battle: null, laser: null, hit: null, powerup: null, select: null };
  var musicSource = null;

  var MENU_PROGRESSION = [
    [110, 130, 165], [98, 123, 147], [87, 110, 130], [98, 123, 147],
  ];
  var BATTLE_PROGRESSION = [
    [98, 117, 147, 175], [87, 104, 131, 156], [110, 131, 165, 196],
  ];

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(masterGain);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.85;
      sfxGain.connect(masterGain);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slide, dest, when) {
    var c = ensureCtx();
    if (!c || muted) return;
    dest = dest || sfxGain;
    var t0 = when != null ? when : c.currentTime;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.08);
  }

  function noise(dur, vol, dest, when) {
    var c = ensureCtx();
    if (!c || muted) return;
    dest = dest || sfxGain;
    var t0 = when != null ? when : c.currentTime;
    var bufferSize = Math.floor(c.sampleRate * dur);
    var buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    var src = c.createBufferSource();
    src.buffer = buffer;
    var gain = c.createGain();
    gain.gain.setValueAtTime(vol || 0.05, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(gain);
    gain.connect(dest);
    src.start(t0);
  }

  function playPad(notes, dur, vol) {
    var c = ensureCtx();
    if (!c || muted) return;
    var t0 = c.currentTime;
    notes.forEach(function (freq, i) {
      var osc = c.createOscillator();
      var gain = c.createGain();
      var filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = inBattle ? 2200 : 1600;
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1) * 7;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime((vol || 0.018) / notes.length, t0 + 0.08);
      gain.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });
  }

  function playBass(freq, dur, vol) {
    tone(freq / 2, dur, 'sine', vol || 0.035, freq / 2.2, musicGain);
  }

  function playArp(notes, stepDur) {
    var c = ensureCtx();
    if (!c || muted) return;
    var idx = musicStep % notes.length;
    tone(notes[idx] * 2, stepDur * 0.85, 'sine', inBattle ? 0.022 : 0.028, notes[idx] * 1.5, musicGain);
  }

  function playDrum() {
    if (!inBattle) return;
    noise(0.04, 0.045, musicGain);
    tone(55, 0.12, 'sine', 0.05, 30, musicGain);
  }

  function playHiHat() {
    if (!inBattle) return;
    noise(0.025, 0.012, musicGain);
  }

  function playMusicTick() {
    if (!ctx || muted) return;
    var prog = inBattle ? BATTLE_PROGRESSION : MENU_PROGRESSION;
    var chord = prog[Math.floor(musicStep / 4) % prog.length];
    var beat = musicStep % 4;

    if (beat === 0) {
      playPad(chord, inBattle ? 0.55 : 0.9, inBattle ? 0.05 : 0.06);
      playBass(chord[0], inBattle ? 0.45 : 0.75);
      if (inBattle) playDrum();
    }
    if (inBattle && beat === 2) playDrum();
    if (inBattle && beat % 2 === 1) playHiHat();

    playArp(chord, inBattle ? 0.14 : 0.22);
    musicStep++;
  }

  function fadeMusic(to, ms) {
    if (musicSource instanceof Audio) {
      musicSource.volume = to;
      return;
    }
    if (!ctx || !musicGain) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(to, ctx.currentTime + ms / 1000);
  }

  function stopFileMusic() {
    if (musicSource) {
      if (musicSource instanceof Audio) {
        musicSource.pause();
        musicSource.currentTime = 0;
      } else {
        try { musicSource.stop(); } catch (e) {}
      }
      musicSource = null;
    }
  }

  function loadAudioFile(url) {
    if (!url) return Promise.reject(new Error('no url'));
    if (window.location.protocol === 'file:') {
      return new Promise(function(resolve, reject) {
        var a = new Audio(url);
        if (a.readyState >= 3) return resolve(a);
        a.addEventListener('loadeddata', function() { resolve(a); });
        a.addEventListener('error', function() { reject(new Error('Audio load failed')); });
      });
    }
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('missing');
      return r.arrayBuffer();
    }).then(function (buf) {
      var c = ensureCtx();
      return c.decodeAudioData(buf);
    });
  }

  function tryLoadMusic() {
    if (!HR.assets || !HR.assets.paths) return;
    var p = HR.assets.paths;
    loadAudioFile(p.menuMusic).catch(function () {
      return loadAudioFile(p.menuMusicOgg);
    }).then(function (buf) { audioBuffers.menu = buf; }).catch(function () {});

    loadAudioFile(p.battleMusic).catch(function () {
      return loadAudioFile(p.battleMusicOgg);
    }).then(function (buf) { audioBuffers.battle = buf; }).catch(function () {});
    
    if (p.sfxLaser) loadAudioFile(p.sfxLaser).then(function(buf) { audioBuffers.laser = buf; }).catch(function() {});
    if (p.sfxHit) loadAudioFile(p.sfxHit).then(function(buf) { audioBuffers.hit = buf; }).catch(function() {});
    if (p.sfxPowerup) loadAudioFile(p.sfxPowerup).then(function(buf) { audioBuffers.powerup = buf; }).catch(function() {});
    if (p.sfxSelect) loadAudioFile(p.sfxSelect).then(function(buf) { audioBuffers.select = buf; }).catch(function() {});
  }

  function playBuffer(buf, vol) {
    if (!buf || muted) return false;
    if (buf instanceof Audio) {
      var a = buf.cloneNode();
      a.volume = vol || 0.4;
      a.play().catch(function(){});
      return true;
    }
    if (!ctx) return false;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = vol || 0.4;
    src.connect(gain);
    gain.connect(sfxGain);
    src.start(0);
    return true;
  }

  function playFileMusic(kind) {
    if (muted) return false;
    var buf = kind === 'battle' ? audioBuffers.battle : audioBuffers.menu;
    if (!buf) return false;

    stopFileMusic();
    
    if (buf instanceof Audio) {
      musicSource = buf;
      musicSource.loop = true;
      musicSource.volume = inBattle ? 0.015 : 0.003; // Significantly lower both volumes
      musicSource.play().catch(function(){});
      return true;
    }

    var c = ensureCtx();
    if (!c) return false;
    
    musicSource = c.createBufferSource();
    musicSource.buffer = buf;
    musicSource.loop = true;
    musicSource.connect(musicGain);
    musicSource.start(0);
    fadeMusic(inBattle ? 0.06 : 0.08, 800);
    return true;
  }

  function startSynthMusic() {
    if (musicTimer) return;
    fadeMusic(inBattle ? 0.05 : 0.07, 1000);
    musicTimer = setInterval(playMusicTick, inBattle ? 420 : 680);
  }

  HR.audio = {
    unlock: function () { ensureCtx(); tryLoadMusic(); },
    toggleMute: function () {
      muted = !muted;
      if (muted) {
        fadeMusic(0, 400);
        stopFileMusic();
      } else {
        HR.audio.startMenuMusic();
      }
      return muted;
    },
    isMuted: function () { return muted; },

    startMenuMusic: function () {
      ensureCtx();
      inBattle = false;
      musicStep = 0;
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      stopFileMusic();
      if (!playFileMusic('menu')) {
        startSynthMusic();
      }
    },

    startBattleMusic: function () {
      ensureCtx();
      inBattle = true;
      musicStep = 0;
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      stopFileMusic();
      if (!playFileMusic('battle')) {
        startSynthMusic();
      }
    },

    stopMusic: function () {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      stopFileMusic();
      fadeMusic(0, 500);
    },

    getVolumeForPos: function (x, y, maxVol) {
      if (x === undefined || y === undefined) return maxVol;
      var pos = HR.getMyPos ? HR.getMyPos() : null;
      if (!pos) return maxVol;
      var d = Math.hypot(x - pos.x, y - pos.y);
      var maxDist = 1400;
      var vol = Math.max(0, 1 - (d / maxDist));
      return vol * maxVol;
    },

    shoot: function (x, y) { 
      var vol = HR.audio.getVolumeForPos(x, y, 0.2);
      playBuffer(audioBuffers.laser, vol);
    },
    hit: function (x, y) { 
      var vol = HR.audio.getVolumeForPos(x, y, 0.25);
      if (audioBuffers.hit instanceof Audio) {
        var a = audioBuffers.hit.cloneNode();
        a.volume = vol;
        a.playbackRate = 1.0;
        a.play().catch(function(){});
      } else {
        playBuffer(audioBuffers.hit, vol);
      }
    },
    explode: function (x, y) { 
      var vol = HR.audio.getVolumeForPos(x, y, 0.4);
      if (audioBuffers.hit instanceof Audio) {
        var a = audioBuffers.hit.cloneNode();
        a.volume = vol;
        a.playbackRate = 0.5; // Pitched down for explosion
        a.play().catch(function(){});
      } else {
        playBuffer(audioBuffers.hit, vol);
      }
    },
    dash: function (x, y) { 
      var vol = HR.audio.getVolumeForPos(x, y, 0.15);
      if (audioBuffers.laser instanceof Audio) {
        var a = audioBuffers.laser.cloneNode();
        a.volume = vol * 0.7;
        a.playbackRate = 0.4; // Low swoosh sound using laser
        a.play().catch(function(){});
      }
    },
    pickupGem: function (x, y) {
      var vol = HR.audio.getVolumeForPos(x, y, 0.2);
      if (audioBuffers.select instanceof Audio) {
        var a = audioBuffers.select.cloneNode();
        a.volume = vol;
        a.playbackRate = 2.5; // High pitch for gem
        a.play().catch(function(){});
      }
    },
    levelUp: function () {
      playBuffer(audioBuffers.powerup, 0.3);
    },
    ui: function () { 
      playBuffer(audioBuffers.select, 0.3);
    },
    uiHover: function () {
      if (audioBuffers.select instanceof Audio) {
        var a = audioBuffers.select.cloneNode();
        a.volume = 0.1;
        a.playbackRate = 3.0;
        a.play().catch(function(){});
      }
    },
    loadingTick: function(stepIndex) {
      if (audioBuffers.select instanceof Audio) {
        var a = audioBuffers.select.cloneNode();
        a.volume = 0.25;
        a.playbackRate = 1.0 + (stepIndex * 0.1);
        a.play().catch(function(){});
      }
    }
  };

  var unlocked = false;
  function unlockOnce() {
    if (unlocked) return;
    unlocked = true;
    HR.audio.unlock();
    if (!inBattle) HR.audio.startMenuMusic();
  }

  ['click', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, unlockOnce, { passive: true });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryLoadMusic);
  } else {
    setTimeout(tryLoadMusic, 100);
  }
})(window.HR);
