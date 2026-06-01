(function (HR) {
  var keys = { w: false, a: false, s: false, d: false };
  var mouse = { x: 0, y: 0, down: false };
  var touchMove = { x: 0, y: 0, active: false };
  var touchFire = false;
  var touchDash = false;
  var dashQueued = false;

  HR.getInputSnapshot = function (canvas) {
    var cx = canvas.width / 2;
    var cy = canvas.height / 2;
    var angle = Math.atan2(mouse.y - cy, mouse.x - cx);

    var w = keys.w;
    var a = keys.a;
    var s = keys.s;
    var d = keys.d;

    if (touchMove.active) {
      a = touchMove.x < -0.25;
      d = touchMove.x > 0.25;
      w = touchMove.y < -0.25;
      s = touchMove.y > 0.25;
    }

    var snap = {
      w: w, a: a, s: s, d: d,
      angle: angle,
      click: mouse.down || touchFire,
      dash: dashQueued || touchDash,
    };
    dashQueued = false;
    touchDash = false;
    return snap;
  };

  HR.initInput = function (canvas) {
    window.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') keys.w = true;
      if (key === 'a' || e.key === 'ArrowLeft') keys.a = true;
      if (key === 's' || e.key === 'ArrowDown') keys.s = true;
      if (key === 'd' || e.key === 'ArrowRight') keys.d = true;
      if (key === 'q') { dashQueued = true; e.preventDefault(); }
      if (['w', 'a', 's', 'd', ' ', 'q'].indexOf(key) !== -1) e.preventDefault();
    });

    window.addEventListener('keyup', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') keys.w = false;
      if (key === 'a' || e.key === 'ArrowLeft') keys.a = false;
      if (key === 's' || e.key === 'ArrowDown') keys.s = false;
      if (key === 'd' || e.key === 'ArrowRight') keys.d = false;
    });

    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', function (e) {
      if (e.button === 0) mouse.down = true;
    });

    window.addEventListener('mouseup', function () {
      mouse.down = false;
    });

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    setupTouchControls();
  };

  function setupTouchControls() {
    var stick = document.getElementById('touch-stick');
    var stickKnob = document.getElementById('touch-stick-knob');
    var fireBtn = document.getElementById('touch-fire');
    var dashBtn = document.getElementById('touch-dash');
    if (!stick || !stickKnob || !fireBtn) return;

    var stickCenter = { x: 0, y: 0 };
    var stickId = null;

    function updateStick(clientX, clientY) {
      var dx = clientX - stickCenter.x;
      var dy = clientY - stickCenter.y;
      var max = 42;
      var len = Math.hypot(dx, dy) || 1;
      var nx = (dx / len) * Math.min(max, len);
      var ny = (dy / len) * Math.min(max, len);
      stickKnob.style.transform = 'translate(calc(-50% + ' + nx + 'px), calc(-50% + ' + ny + 'px))';
      touchMove.x = nx / max;
      touchMove.y = ny / max;
      touchMove.active = true;
    }

    stick.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      stickId = t.identifier;
      var rect = stick.getBoundingClientRect();
      stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateStick(t.clientX, t.clientY);
    }, { passive: false });

    stick.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === stickId) updateStick(t.clientX, t.clientY);
      }
    }, { passive: false });

    function resetStick(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === stickId) {
          stickId = null;
          touchMove = { x: 0, y: 0, active: false };
          stickKnob.style.transform = 'translate(-50%, -50%)';
        }
      }
    }

    stick.addEventListener('touchend', resetStick);
    stick.addEventListener('touchcancel', resetStick);

    fireBtn.addEventListener('touchstart', function (e) {
      e.preventDefault();
      touchFire = true;
    }, { passive: false });

    fireBtn.addEventListener('touchend', function () { touchFire = false; });

    if (dashBtn) {
      dashBtn.addEventListener('touchstart', function (e) {
        e.preventDefault();
        touchDash = true;
      }, { passive: false });
    }
  }
})(window.HR);
