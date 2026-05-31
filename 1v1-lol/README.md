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

- **No Google login required** — the game receives a local session that looks like a completed Google sign-in (JWT-shaped token + saved profile).
- **Locker and shop** unlock automatically after load; tapping sign-in also completes instantly.
- **99,999 LOLCoins** on first visit (saved in `localStorage` under `1v1_game_save_v2`, spends persist).
- **Lightweight** — no real Firebase SDK (~2MB); only small JS shims, no polling loops.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Fullscreen launcher |
| `UnityLoader.js`, `WebGL.json`, `rc.*.unityweb` | Unity game |
| `js/firebase-mock.js` | Local auth + Firestore + coins |
| `js/login.js` | Login API expected by Unity |
| `js/firebase-config.js` | Shop skins / modes config |
| `js/firestore.js` | Player data listener bridge |
