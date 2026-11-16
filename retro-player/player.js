(function () {
    const PRIMARY_CDN = "https://cdn.jsdelivr.net/gh/bubblfan/emu@master/";
    const FALLBACK_CDN = "https://cdn.jsdelivr.net/gh/EmulatorJS/EmulatorJS@main/data/";

    function createOverlay(titleText) {
        const stage = document.createElement("div");
        stage.className = "hh-stage";

        const gameRoot = document.createElement("div");
        gameRoot.id = "game";

        const overlay = document.createElement("div");
        overlay.className = "hh-loader-overlay";

        const card = document.createElement("div");
        card.className = "hh-loader-card";

        const title = document.createElement("h1");
        title.className = "hh-loader-title";
        title.textContent = titleText || "Starting game";

        const status = document.createElement("p");
        status.className = "hh-loader-status";
        status.textContent = "Preparing files...";

        const track = document.createElement("div");
        track.className = "hh-progress-track";

        const fill = document.createElement("div");
        fill.className = "hh-progress-fill";

        track.appendChild(fill);
        card.appendChild(title);
        card.appendChild(status);
        card.appendChild(track);
        overlay.appendChild(card);
        stage.appendChild(gameRoot);
        stage.appendChild(overlay);
        document.body.appendChild(stage);

        return { overlay, card, status, fill, track };
    }

    function buildPartUrls(partsSpec) {
        const urls = [];
        const padWidth = partsSpec.pad || 0;
        for (let i = partsSpec.start; i <= partsSpec.end; i++) {
            const suffix = padWidth > 0 ? String(i).padStart(padWidth, "0") : String(i);
            urls.push(partsSpec.base + suffix);
        }
        return urls;
    }

    async function fetchAndMergeParts(urls, romName, onProgress) {
        const buffers = [];
        for (let i = 0; i < urls.length; i++) {
            const response = await fetch(urls[i]);
            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }
            buffers.push(await response.arrayBuffer());
            onProgress(i + 1, urls.length);
        }
        return romName ? new File(buffers, romName) : URL.createObjectURL(new Blob(buffers));
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error("Script load failed: " + src));
            document.body.appendChild(script);
        });
    }

    async function bootEmulator(cfg, ui) {
        let gameUrl = cfg.url || "";
        if (cfg.parts) {
            const urls = Array.isArray(cfg.parts) ? cfg.parts : buildPartUrls(cfg.parts);
            ui.status.textContent = "Downloading game data (0 of " + urls.length + ")";
            gameUrl = await fetchAndMergeParts(urls, cfg.romName, (done, total) => {
                const pct = Math.round((done / total) * 100);
                ui.fill.style.width = pct + "%";
                ui.status.textContent = "Downloading game data (" + done + " of " + total + ")";
            });
        } else {
            ui.fill.style.width = "65%";
            ui.status.textContent = "Starting player...";
        }

        const primaryBase = cfg.dataPath || PRIMARY_CDN;
        window.EJS_player = "#game";
        window.EJS_core = cfg.core;
        window.EJS_gameName = cfg.title;
        window.EJS_gameUrl = gameUrl;
        window.EJS_color = "#18181b";
        window.EJS_startOnLoaded = true;
        window.EJS_threads = false;
        window.EJS_pathtodata = primaryBase;

        if (cfg.biosUrl) {
            window.EJS_biosUrl = cfg.biosUrl;
        }
        if (cfg.defaultOptions) {
            window.EJS_defaultOptions = cfg.defaultOptions;
        }

        ui.overlay.classList.add("is-hidden");

        try {
            await loadScript(primaryBase + "loader.js");
        } catch (_err) {
            window.EJS_pathtodata = FALLBACK_CDN;
            await loadScript(FALLBACK_CDN + "loader.js");
        }
    }

    function showError(ui, cfg) {
        ui.overlay.classList.remove("is-hidden");
        ui.track.style.display = "none";
        ui.status.textContent = "Could not load this game right now.";
        let btn = ui.card.querySelector(".hh-retry-btn");
        if (!btn) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.className = "hh-retry-btn";
            btn.textContent = "Try again";
            btn.addEventListener("click", () => {
                btn.remove();
                ui.track.style.display = "block";
                ui.fill.style.width = "0%";
                ui.status.textContent = "Preparing files...";
                start(cfg, ui);
            });
            ui.card.appendChild(btn);
        }
    }

    function start(cfg, ui) {
        bootEmulator(cfg, ui).catch(() => showError(ui, cfg));
    }

    document.addEventListener("DOMContentLoaded", () => {
        const cfg = window.HH_EMU_CONFIG;
        if (!cfg || !cfg.core) {
            return;
        }
        document.title = cfg.title || "Game";
        const ui = createOverlay(cfg.title);
        start(cfg, ui);
    });
})();
