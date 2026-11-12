/*! coi-serviceworker - H&H hardened COOP/COEP + CDN failover worker */
let coepCredentialless = true;

if (typeof window === "undefined") {
  const AD_HOSTS = new Set([
    "cdn.intergient.com",
    "api.adinplay.com",
    "pagead2.googlesyndication.com",
    "googleads.g.doubleclick.net",
    "www.googletagmanager.com",
    "www.google-analytics.com",
    "mc.yandex.ru",
    "sdk.crazygames.com",
    "game-cdn.poki.com",
    "accounts.google.com",
    "assets.msn.com"
  ]);

  const WORKER_CDN_PROXY = "https://homework-socket.hnhai.workers.dev/cdn/";

  const JSDELIVR_HOSTS = new Set([
    "cdn.jsdelivr.net",
    "fastly.jsdelivr.net",
    "gcore.jsdelivr.net",
    "testingcf.jsdelivr.net"
  ]);

  const WORKER_ALLOWED_HOSTS = new Set([
    "cdn.jsdelivr.net",
    "fastly.jsdelivr.net",
    "gcore.jsdelivr.net",
    "raw.githubusercontent.com",
    "rawcdn.githack.com",
    "unpkg.com",
    "esm.sh"
  ]);

  const MIME_MAP = {
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf"
  };

  function inferMime(pathname) {
    const clean = pathname.split("?")[0].toLowerCase();
    const dot = clean.lastIndexOf(".");
    if (dot !== -1) {
      const ext = clean.slice(dot);
      if (MIME_MAP[ext]) return MIME_MAP[ext];
    }
    return "application/octet-stream";
  }

  function expectsHtml(pathname) {
    const clean = pathname.split("?")[0].toLowerCase();
    return clean.endsWith("/") || clean.endsWith(".html") || clean.endsWith(".htm");
  }

  function isBlockedOrBadResponse(pathname, res, candidateUrl) {
    if (!res || res.status === 0) return false;
    if (!res.ok) return true;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!expectsHtml(pathname) && ct.includes("text/html")) return true;
    if (candidateUrl && candidateUrl.startsWith(WORKER_CDN_PROXY) && res.headers.get("x-hh-proxy") !== "1") {
      return true;
    }
    return false;
  }

  function buildMirrorUrls(url) {
    const out = [];
    const { hostname, pathname, search } = url;

    if (JSDELIVR_HOSTS.has(hostname)) {
      if (hostname !== "fastly.jsdelivr.net") {
        out.push("https://fastly.jsdelivr.net" + pathname + search);
      }
      if (pathname.startsWith("/gh/")) {
        const rest = pathname.slice(4);
        const slash1 = rest.indexOf("/");
        if (slash1 !== -1) {
          const owner = rest.slice(0, slash1);
          const afterOwner = rest.slice(slash1 + 1);
          const slash2 = afterOwner.indexOf("/");
          if (slash2 !== -1) {
            const repoAndRef = afterOwner.slice(0, slash2);
            const filePath = afterOwner.slice(slash2 + 1);
            const at = repoAndRef.indexOf("@");
            if (at !== -1) {
              const repo = repoAndRef.slice(0, at);
              const ref = repoAndRef.slice(at + 1);
              if (ref === "latest") {
                out.push(`https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}${search}`);
                out.push(`https://raw.githubusercontent.com/${owner}/${repo}/master/${filePath}${search}`);
              } else {
                out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}${search}`);
              }
            } else {
              out.push(`https://raw.githubusercontent.com/${owner}/${repoAndRef}/main/${filePath}${search}`);
              out.push(`https://raw.githubusercontent.com/${owner}/${repoAndRef}/master/${filePath}${search}`);
            }
          }
        }
      } else if (pathname.startsWith("/npm/")) {
        const rest = pathname.slice(5);
        if (rest.endsWith("/+esm")) {
          out.push("https://esm.sh/" + rest.slice(0, -5) + search);
        } else {
          out.push("https://unpkg.com/" + rest + search);
        }
      }
    } else if (hostname === "rawcdn.githack.com") {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 4) {
        const [owner, repo, ref, ...rest] = parts;
        out.push(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join("/")}${search}`);
      }
    }

    const proxyHost = WORKER_ALLOWED_HOSTS.has(hostname) ? hostname : "cdn.jsdelivr.net";
    out.push(WORKER_CDN_PROXY + proxyHost + pathname + search);
    for (let i = 0; i < out.length - 1; i++) {
      const directUrl = out[i];
      if (directUrl.startsWith("https://raw.githubusercontent.com/")) {
        out.push(WORKER_CDN_PROXY + directUrl.slice("https://".length));
      }
    }

    return out;
  }

  function isAdOrAnalytics(url) {
    if (AD_HOSTS.has(url.hostname)) return true;
    if (JSDELIVR_HOSTS.has(url.hostname) && url.pathname.includes("yandex-metrica-watch")) return true;
    return false;
  }

  function createStubScriptResponse() {
    return new Response("", {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Cache-Control": "no-store"
      }
    });
  }

  function wrapWithHeaders(res, isSameOrigin, fixRawMimePath, method) {
    if (!res || res.status === 0) return res;
    const headers = new Headers(res.headers);
    if (method !== "HEAD" && (headers.has("content-encoding") || !isSameOrigin)) {
      headers.delete("content-encoding");
      headers.delete("content-length");
    }
    headers.delete("x-content-type-options");

    if (fixRawMimePath) {
      const currentCt = (headers.get("content-type") || "").toLowerCase();
      if (!currentCt || currentCt.startsWith("text/plain") || currentCt === "application/octet-stream") {
        headers.set("Content-Type", inferMime(fixRawMimePath));
      }
      if (!headers.has("Access-Control-Allow-Origin")) {
        headers.set("Access-Control-Allow-Origin", "*");
      }
      headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    }

    if (isSameOrigin) {
      headers.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
      if (!coepCredentialless) {
        headers.set("Cross-Origin-Resource-Policy", "cross-origin");
      }
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
    } else {
      if (!headers.has("Access-Control-Allow-Origin")) {
        headers.set("Access-Control-Allow-Origin", "*");
      }
      headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    }

    return new Response(method === "HEAD" ? null : res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  }

  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

  self.addEventListener("message", e => {
    if (!e.data) return;
    if (e.data.type === "deregister") {
      self.registration.unregister()
        .then(() => self.clients.matchAll())
        .then(clients => clients.forEach(client => client.navigate(client.url)));
    } else if (e.data.type === "coepCredentialless") {
      coepCredentialless = Boolean(e.data.value);
    }
  });

  self.addEventListener("fetch", e => {
    const req = e.request;
    if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;

    let url;
    try {
      url = new URL(req.url);
    } catch {
      return;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") return;

    const isSameOrigin = url.origin === self.location.origin;
    const isAd = !isSameOrigin && isAdOrAnalytics(url);
    const isCdn = !isSameOrigin && (JSDELIVR_HOSTS.has(url.hostname) || url.hostname === "rawcdn.githack.com");

    if (!isSameOrigin && !isAd && !isCdn && coepCredentialless) {
      return;
    }

    const fetchReq = req.mode === "no-cors" && !isSameOrigin
      ? new Request(req, { credentials: "omit" })
      : req;

    e.respondWith((async () => {
      if (isAd) {
        try {
          const adRes = await fetch(fetchReq);
          if (adRes.status === 0 || (adRes.ok && !isBlockedOrBadResponse(url.pathname, adRes))) {
            return wrapWithHeaders(adRes, false, null, req.method);
          }
        } catch {}
        return createStubScriptResponse();
      }

      if (isCdn && (req.method === "GET" || req.method === "HEAD")) {
        const range = req.headers.get("range");
        const corsInit = {
          method: req.method,
          mode: "cors",
          credentials: "omit"
        };
        if (range) corsInit.headers = { Range: range };

        try {
          const primary = await fetch(req.url, corsInit);
          if (!isBlockedOrBadResponse(url.pathname, primary)) {
            return wrapWithHeaders(primary, false, null, req.method);
          }
        } catch {}

        const mirrors = buildMirrorUrls(url);
        for (const mirrorUrl of mirrors) {
          try {
            const mirrorRes = await fetch(mirrorUrl, corsInit);
            if (!isBlockedOrBadResponse(url.pathname, mirrorRes, mirrorUrl)) {
              const needsMimeFix = mirrorUrl.includes("raw.githubusercontent.com/");
              return wrapWithHeaders(mirrorRes, false, needsMimeFix ? url.pathname : null, req.method);
            }
          } catch {}
        }

        return Response.error();
      }

      try {
        const res = await fetch(fetchReq);
        if (res.status === 0) return res;
        return wrapWithHeaders(res, isSameOrigin, null, req.method);
      } catch {
        return Response.error();
      }
    })());
  });
} else {
  (() => {
    const supportsCredentialless = () => {
      const ua = navigator.userAgent || "";
      const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);
      return !isSafari;
    };

    const config = {
      shouldRegister: () => true,
      shouldDeregister: () => false,
      coepCredentialless: supportsCredentialless,
      doReload: () => {
        try {
          if (sessionStorage.getItem("coi-reloaded") === "1") return;
          sessionStorage.setItem("coi-reloaded", "1");
        } catch {}
        window.location.reload();
      },
      quiet: true,
      ...window.coi
    };

    const nav = navigator;
    if (nav.serviceWorker && nav.serviceWorker.controller) {
      nav.serviceWorker.controller.postMessage({
        type: "coepCredentialless",
        value: config.coepCredentialless()
      });
      if (config.shouldDeregister()) {
        nav.serviceWorker.controller.postMessage({ type: "deregister" });
      }
    }

    if (window.crossOriginIsolated === false && config.shouldRegister() && window.isSecureContext && nav.serviceWorker) {
      const scriptUrl = window.document.currentScript ? window.document.currentScript.src : "coi-serviceworker.js";
      nav.serviceWorker.register(scriptUrl).then(reg => {
        if (!config.quiet) console.log("COOP/COEP Service Worker registered", reg.scope);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "activated") {
              config.doReload();
            }
          });
        });
        if (reg.active && !nav.serviceWorker.controller) {
          config.doReload();
        }
      }).catch(err => {
        if (!config.quiet) console.error("COOP/COEP Service Worker failed to register:", err);
      });
    }
  })();
}
