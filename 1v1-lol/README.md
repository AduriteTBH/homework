# 1v1.LOL (fullscreen)

Original Unity WebGL game files, hosted for your site — **no portal**, **no ads**, **fullscreen**.

## Run locally

```powershell
cd "c:\Users\aduri\Documents\GitHub\homework\1v1-lol"
python -m http.server 8080
```

Open `http://localhost:8080/`

## GitHub Pages

Push this folder as the site root. Uses relative paths and works over HTTPS.

## What’s included

- Original `UnityLoader.js`, `WebGL.json`, game binaries (`rc.*.unityweb`)
- Original Firebase + login + Firestore scripts (real Google sign-in when it works)
- Fullscreen layout (`css/style.css`)

## Embed on another page

```html
<iframe
  src="https://YOUR_USERNAME.github.io/1v1-lol/"
  style="width: 100vw; height: 100vh; border: 0;"
  allowfullscreen
></iframe>
```

## Why PLAY does nothing

The yellow **PLAY!** button starts **online matchmaking** (Photon). This build’s Photon App Id (`82620531-…`) is **archived** on Photon’s servers, so the game logs:

`GetRegions failed … ApplicationArchived`

That is a **dead official server**, not a bug in your site layout.

### What works without fixing Photon

- **Free Build** (left tile) — building practice, usually offline  
- **Practice / Aim Trainer / Zombies** — if shown in the mode menu (from game config)

### Fix PLAY (online) — your own Photon app (free)

1. Create a free app at [Photon Dashboard](https://dashboard.photonengine.com/) (PUN / Realtime).
2. Copy the **Realtime App ID** (36-character UUID).
3. Run from this folder:

```powershell
python scripts/patch-photon-appid.py PASTE-YOUR-PHOTON-APP-ID-HERE
```

4. Push and redeploy. PLAY will connect to **your** Photon app (you won’t match official 1v1.lol players, but you can test with friends on the same App Id).

## Other notes

- Login / shop use **original** Firebase and `justbuild.xyz` APIs when those still respond.
- Stock game — no custom offline account mod.
