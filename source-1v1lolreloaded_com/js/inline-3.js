
  (function(){
    var _origPush = history.pushState;
    var _origReplace = history.replaceState;
    function _isUnityUrlTrack() {
      var stack = '';
      try { throw new Error(); } catch (e) { stack = e.stack || ''; }
      return stack.indexOf('_SetUrlPostfix') !== -1;
    }
    history.pushState = function(state, title, url) {
      if (_isUnityUrlTrack()) {
        // Unity Playtika analytics hook — suppress URL mutation; canonical client
        // doesn't read URL state, so this is a pure JS-side side effect we don't want.
        return;
      }
      return _origPush.apply(history, arguments);
    };
    history.replaceState = function(state, title, url) {
      if (_isUnityUrlTrack()) return;
      return _origReplace.apply(history, arguments);
    };
  })();
  