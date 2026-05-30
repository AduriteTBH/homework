
  (function(){
    if (location.search.indexOf('reset_idb=1') === -1) return;
    if (sessionStorage.getItem('_idb_just_reset') === '1') {
      sessionStorage.removeItem('_idb_just_reset');
      console.log('[DEV] IDBFS reset complete — Unity will start cold');
      return;
    }
    console.log('[DEV] reset_idb=1 → wiping Unity IDBFS PlayerPrefs');
    var done = function(){
      sessionStorage.setItem('_idb_just_reset', '1');
      var url = location.pathname + location.search.replace(/[?&]reset_idb=1/, '').replace(/^&/, '?');
      location.replace(url || location.pathname);
    };
    try {
      if (indexedDB.databases) {
        indexedDB.databases().then(function(dbs){
          var pending = 0, finished = false;
          dbs.forEach(function(d){
            if (!d.name) return;
            pending++;
            var req = indexedDB.deleteDatabase(d.name);
            req.onsuccess = req.onerror = req.onblocked = function(){
              if (--pending === 0 && !finished) { finished = true; done(); }
            };
          });
          if (pending === 0) done();
        }).catch(done);
      } else {
        // Older browsers — best-effort: try common Unity 4.23 paths.
        ['/idbfs','UnityCache'].forEach(function(n){ try { indexedDB.deleteDatabase(n); } catch(e){} });
        setTimeout(done, 500);
      }
    } catch (e) { done(); }
  })();
  