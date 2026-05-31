(function () {
  var API_HOST = "justbuild.xyz";

  function isGameApi(url) {
    return url && String(url).indexOf(API_HOST) !== -1;
  }

  function jsonResponse(body) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function handleGameApi(url, method, body) {
    var path = String(url).split(API_HOST)[1] || "";
    var profile = window.getLocalPlayerProfile();

    if (path.indexOf("player/login") !== -1) {
      return jsonResponse(profile);
    }

    if (path.indexOf("player/skins") !== -1 && method === "POST") {
      try {
        if (body) {
          var parsed = typeof body === "string" ? JSON.parse(body) : body;
          if (parsed.ids) {
            window.mergeLocalPlayerProfile({ EquippedWeaponSkins: parsed.ids });
          }
          if (parsed.id) {
            window.mergeLocalPlayerProfile({ EquippedCharacterSkin: parsed.id });
          }
          if (parsed.data) {
            window.mergeLocalPlayerProfile(parsed.data);
          }
        }
      } catch (e) {}
      return jsonResponse(profile);
    }

    if (path.indexOf("player/") !== -1) {
      return jsonResponse(profile);
    }

    return jsonResponse({ ok: true });
  }

  if (typeof window.fetch === "function") {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : input && input.url;
      if (isGameApi(url)) {
        var method = (init && init.method) || "GET";
        var body = init && init.body;
        return Promise.resolve(handleGameApi(url, method, body));
      }
      return origFetch.apply(this, arguments);
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__gameApiUrl = url;
    this.__gameApiMethod = method;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (isGameApi(this.__gameApiUrl)) {
      var response = handleGameApi(this.__gameApiUrl, this.__gameApiMethod, body);
      var self = this;
      response.text().then(function (text) {
        Object.defineProperty(self, "status", { value: 200 });
        Object.defineProperty(self, "responseText", { value: text });
        Object.defineProperty(self, "response", { value: text });
        Object.defineProperty(self, "readyState", { value: 4 });
        if (typeof self.onload === "function") self.onload();
        if (typeof self.onreadystatechange === "function") self.onreadystatechange();
      });
      return;
    }
    return origSend.apply(this, arguments);
  };
})();
