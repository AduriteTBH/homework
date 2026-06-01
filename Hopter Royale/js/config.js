(function (HR) {
  HR.CONFIG = {
    MAP_SIZE: 5000,
    MAX_PLAYERS: 30,
    TICK_RATE: 30,
    BOT_FILL: true,
    ROOM_CODE_LEN: 5,
    PEER_PREFIX: 'hr-',
    STORM_START_RATIO: 0.75,
    STORM_MIN_RADIUS: 80,
    STORM_SHRINK: 0.22,
    CRATE_COUNT: 70,
    GEM_XP: 18,
    POWERUP_CHANCE: 1.0,
    POWERUP_TYPES: ['health', 'shield', 'speed'],
    ACCEL: 0.95,
    MAX_SPEED: 9.2,
    FRICTION: 0.88,
    BULLET_LIFE: 80,
    DASH_SPEED: 26,
    DASH_DURATION: 6,
    DASH_COOLDOWN: 50,
    RESPAWN_DISABLED: true,
    GITHUB_PLAY_URL: 'https://aduritetbh.github.io/homework/Hopter%20Royale/index.html',
  };

  HR.CALLSIGNS = [
    'SkyHawk', 'RotorBoss', 'HopterChomp', 'AeroViper', 'PropNinja',
    'HopterHound', 'HoverGhost', 'RotorRogue', 'FlightFury', 'SkyStriker',
    'WindWeaver', 'AirAssassin', 'WhirlyBird', 'GatorHopter', 'MetalLocust',
    'SteelWasp', 'IronDragon', 'StormRider', 'BladeRunner', 'ThunderRotor',
  ];

  HR.PLAYER_COLORS = [
    '#4cd137', '#00d2d3', '#54a0ff', '#5f27cd', '#ff6b6b',
    '#feca57', '#48dbfb', '#ff9ff3', '#1dd1a1', '#576574',
    '#e1b12c', '#c23616', '#2f3640', '#8c7ae6', '#e84118',
    '#341f97', '#ff9f43', '#0abde3', '#10ac84', '#ee5253',
    '#f368e0', '#222f3e', '#1e90ff', '#2ed573', '#ffa502',
    '#ff4757', '#7bed9f', '#5352ed', '#eccc68', '#a4b0be'
  ];

  HR.PEER_CONFIG = {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    },
  };
})(window.HR = window.HR || {});
