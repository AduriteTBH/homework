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

## Notes

- Login, shop, and online play depend on the **original** 1v1 backends (Firebase / Photon). Some features may not work if those services are down or blocked.
- This is the stock game behavior — not the custom offline/coins mod from earlier.
