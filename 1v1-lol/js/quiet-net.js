(function () {
  var blockedHosts = ["notify.bugsnag.com", "sessions.bugsnag.com"];

  function isBlocked(url) {
    if (!url) return false;
    var s = String(url);
    for (var i = 0; i < blockedHosts.length; i++) {
      if (s.indexOf(blockedHosts[i]) !== -1) return true;
    }
    return false;
  }

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__blocked = isBlocked(url);
    return origOpen.apply(this, arguments);
  };

  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    if (this.__blocked) {
      var self = this;
      setTimeout(function () {
        Object.defineProperty(self, "status", { value: 204 });
        Object.defineProperty(self, "readyState", { value: 4 });
        if (typeof self.onload === "function") self.onload();
        if (typeof self.onreadystatechange === "function") self.onreadystatechange();
      }, 0);
      return;
    }
    return origSend.apply(this, arguments);
  };

  if (typeof window.fetch === "function") {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : input && input.url;
      if (isBlocked(url)) {
        return Promise.resolve(new Response("", { status: 204 }));
      }
      return origFetch.apply(this, arguments);
    };
  }

  window.Bugsnag = window.Bugsnag || {
    start: function () {},
    notify: function () {},
    leaveBreadcrumb: function () {},
  };
})();
