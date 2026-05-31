# 1v1.LOL (GitHub Pages)

Fullscreen 1v1.LOL WebGL build with portal/ads removed and offline-friendly account + shop support.

## Play locally

```powershell
cd "c:\Users\aduri\Documents\GitHub\homework\1v1-lol"
python -m http.server 8080
```

Open `http://localhost:8080/`

## GitHub Pages

Push this folder as the site root (or publish from `/docs` if you use that layout). The game uses **relative paths** and works over `https://` on GitHub Pages.

Optional: add an empty `.nojekyll` file at the repo root if Jekyll processing causes issues.

## Offline features

- **No Google login required** — any login action succeeds as a local player.
- **99,999 coins** on first visit (stored in `localStorage`, spends persist).
- **Shop** uses local profile data; purchases update `localStorage` via the Firebase mock.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Fullscreen launcher |
| `UnityLoader.js`, `WebGL.json`, `rc.*.unityweb` | Unity game |
| `js/firebase-mock.js` | Local auth + Firestore + coins |
| `js/login.js` | Login API expected by Unity |
| `js/firebase-config.js` | Shop skins / modes config |
| `js/firestore.js` | Player data listener bridge |
