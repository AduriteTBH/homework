(function () {
  'use strict';

  var WORKER_HOST = 'homework-socket.hnhai.workers.dev';
  var WORKER_HTTP = 'https://' + WORKER_HOST + '/1v1/';
  var WORKER_WS = 'wss://' + WORKER_HOST + '/1v1ws/';
  var UPSTREAM_SITE = '1v1lolreloaded.com';

  var SAME_ORIGIN_PREFIXES = [
    '/api/',
    '/StreamingAssets/',
    '/assets/',
    '/fonts/',
    '/photon/',
    '/ws/',
    '/mocks/',
    '/js/',
    '/Build/',
    '/loader-ch2-bg.jpg'
  ];

  function isProxiedUpstreamHost(host) {
    var h = String(host || '').toLowerCase();
    return (
      h === UPSTREAM_SITE ||
      h.endsWith('.' + UPSTREAM_SITE) ||
      h === 'www.gstatic.com' ||
      h === 'www.googleapis.com' ||
      h === 'securetoken.googleapis.com'
    );
  }

  function extractMounted1v1Path(pathname) {
    var saIdx = pathname.indexOf('/StreamingAssets/');
    if (saIdx >= 0) return pathname.slice(saIdx);
    for (var i = 0; i < SAME_ORIGIN_PREFIXES.length; i++) {
      var p = SAME_ORIGIN_PREFIXES[i];
      if (pathname.indexOf(p) === 0) return pathname;
      var subIdx = pathname.indexOf(p);
      if (subIdx > 0 && p !== '/api/' && p !== '/ws/') {
        return pathname.slice(subIdx);
      }
    }
    return null;
  }

  function rewriteHttpUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    if (/^(?:blob:|data:|about:|javascript:)/i.test(rawUrl)) return rawUrl;
    if (rawUrl.indexOf(WORKER_HOST) !== -1) return rawUrl;

    var parsed;
    try {
      parsed = new URL(rawUrl, location.href);
    } catch (e) {
      return rawUrl;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return rawUrl;

    var host = parsed.hostname.toLowerCase();
    if (isProxiedUpstreamHost(host)) {
      return WORKER_HTTP + host + parsed.pathname + parsed.search;
    }

    if (parsed.origin === location.origin) {
      var mappedPath = extractMounted1v1Path(parsed.pathname);
      if (mappedPath) {
        return WORKER_HTTP + UPSTREAM_SITE + mappedPath + parsed.search;
      }
    }

    return rawUrl;
  }

  function rewriteWsUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    if (rawUrl.indexOf(WORKER_HOST) !== -1) return rawUrl;

    var parsed;
    try {
      parsed = new URL(rawUrl, location.href);
    } catch (e) {
      return rawUrl;
    }

    var regionHost = (window.__photonRegion === 'eu' ? 'eu.' : '') + UPSTREAM_SITE;
    var host = parsed.hostname.toLowerCase();
    if (host === UPSTREAM_SITE || host.endsWith('.' + UPSTREAM_SITE)) {
      return WORKER_WS + host + parsed.pathname + parsed.search;
    }

    var lowerHref = parsed.href.toLowerCase();
    if (
      parsed.port === '19090' ||
      host.indexOf('photonengine') !== -1 ||
      host.indexOf('exitgames') !== -1 ||
      lowerHref.indexOf('photonengine') !== -1 ||
      lowerHref.indexOf('exitgames') !== -1
    ) {
      var wsRolePath = '/ws/master';
      var wsHost = regionHost;
      if (lowerHref.indexOf('/ns') !== -1 || lowerHref.indexOf('ns.exitgames') !== -1 || lowerHref.indexOf('ns.photonengine') !== -1 || lowerHref.indexOf('app=nameserver') !== -1) {
        wsRolePath = '/ws/ns';
      } else if (lowerHref.indexOf('/game') !== -1 || lowerHref.indexOf('app=game') !== -1) {
        wsRolePath = '/ws/game';
        if (window.__photonRegion !== 'eu') wsHost = 'ws.' + UPSTREAM_SITE;
      } else {
        wsRolePath = '/ws/master';
        if (window.__photonRegion !== 'eu') wsHost = 'ws.' + UPSTREAM_SITE;
      }
      return WORKER_WS + wsHost + wsRolePath + parsed.search;
    }

    if (host === location.hostname.toLowerCase()) {
      var wsIdx = parsed.pathname.indexOf('/ws/');
      var wsPath = wsIdx >= 0 ? parsed.pathname.slice(wsIdx) : parsed.pathname;
      return WORKER_WS + UPSTREAM_SITE + wsPath + parsed.search;
    }

    return rawUrl;
  }

  if (typeof window.fetch === 'function') {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var origUrl = typeof input === 'string' ? input : (input && input.url) || '';
      var targetUrl = rewriteHttpUrl(origUrl);
      if (targetUrl && targetUrl !== origUrl) {
        var nextInit = init ? Object.assign({}, init) : {};
        if (nextInit.credentials === 'include') nextInit.credentials = 'omit';
        if (typeof input === 'string') {
          return nativeFetch(targetUrl, nextInit);
        }
        return nativeFetch(new Request(targetUrl, input), nextInit);
      }
      return nativeFetch.apply(this, arguments);
    };
  }

  var nativeXhrOpen = XMLHttpRequest.prototype.open;
  var nativeXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    if (typeof url === 'string') {
      var rewritten = rewriteHttpUrl(url);
      if (rewritten !== url) {
        args[1] = rewritten;
        this._hhProxied = true;
      }
    }
    return nativeXhrOpen.apply(this, args);
  };

  XMLHttpRequest.prototype.send = function () {
    if (this._hhProxied && this.withCredentials) {
      try {
        this.withCredentials = false;
      } catch (e) {}
    }
    return nativeXhrSend.apply(this, arguments);
  };

  if (typeof window.WebSocket === 'function') {
    var NativeWebSocket = window.WebSocket;
    var ProxiedWebSocket = function (url, protocols) {
      var targetUrl = rewriteWsUrl(url);
      return arguments.length > 1
        ? new NativeWebSocket(targetUrl, protocols)
        : new NativeWebSocket(targetUrl);
    };
    ProxiedWebSocket.prototype = NativeWebSocket.prototype;
    ProxiedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    ProxiedWebSocket.OPEN = NativeWebSocket.OPEN;
    ProxiedWebSocket.CLOSING = NativeWebSocket.CLOSING;
    ProxiedWebSocket.CLOSED = NativeWebSocket.CLOSED;
    window.WebSocket = ProxiedWebSocket;
  }

  window.__HH_1V1_REWRITE_HTTP = rewriteHttpUrl;
  window.__HH_1V1_REWRITE_WS = rewriteWsUrl;
})();
