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

- **No Google login required** — local session + mocked `justbuild.xyz` player API.
- **99,999 coins** as `HardCurrency` / `SoftCurrency` (what this v3.800 build uses).
- **Locker / shop / equip** — saved in `localStorage` (`1v1_game_save_v3`).
- **Lightweight** — no real Firebase SDK, no listener spam loops.

## Play button / online modes

The console error `GetRegions failed … ApplicationArchived` means the **original Photon multiplayer AppId is shut down**. That is not caused by our login shim. **Online PLAY may not work** on this build without your own Photon app.

**Practice** and other offline modes may still work from the mode menu if the game offers them.

## Files

| Path | Purpose |
|------|---------|
| `index.html` | Fullscreen launcher |
| `UnityLoader.js`, `WebGL.json`, `rc.*.unityweb` | Unity game |
| `js/firebase-mock.js` | Local auth + Firestore + coins |
| `js/login.js` | Login API expected by Unity |
| `js/firebase-config.js` | Shop skins / modes config |
| `js/firestore.js` | Player data listener bridge |
