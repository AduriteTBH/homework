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
})(window.HR);
