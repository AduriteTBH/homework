/**
 * H&H Invaders - UI Manager
 * Handles DOM element bindings, updates HUD metrics (Shield, Hull, Boost, Score, Wave),
 * manages overlay transitions, aligns the custom target reticle, and draws
 * a real-time holographic canvas radar of the combat coordinates.
 */
class UIManager {
    constructor() {
        // Cache DOM elements
        this.mainMenu = document.getElementById('main-menu');
        this.gameHud = document.getElementById('game-hud');
        this.gameOver = document.getElementById('game-over');
        this.warningOverlay = document.getElementById('hud-warning');
        
        // HUD Metrics
        this.waveVal = document.getElementById('hud-wave');
        this.enemiesVal = document.getElementById('hud-enemies-count');
        this.scoreVal = document.getElementById('hud-score');
        this.multVal = document.getElementById('hud-multiplier');
        
        this.shieldFill = document.getElementById('hud-shield-fill');
        this.shieldPct = document.getElementById('hud-shield-pct');
        this.hullFill = document.getElementById('hud-hull-fill');
        this.hullPct = document.getElementById('hud-hull-pct');
        
        this.boostSegments = document.querySelectorAll('.boost-segment');
        
        this.weaponName = document.getElementById('hud-weapon-name');
        this.weaponReady = document.getElementById('hud-weapon-ready');
        this.energyFill = document.getElementById('hud-energy-fill');
        
        // Screens
        this.finalScore = document.getElementById('final-score');
        this.finalWave = document.getElementById('final-wave');
        
        // Reticle
        this.crosshair = document.getElementById('crosshair');

        // Radar Canvas setup
        this.radarCanvas = document.getElementById('radar-canvas');
        this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;
        this.radarSweepAngle = 0;

        this.initRadarCanvas();
        this.initMenuNavigation();
    }

    /**
     * Initializes the click event listeners for Main Menu sub-page navigation.
     */
    initMenuNavigation() {
        const navButtons = {
            'nav-controls-btn': 'menu-controls',
            'nav-settings-btn': 'menu-settings',
            'nav-credits-btn': 'menu-credits'
        };

        // Bind main menu navigation buttons
        for (const [btnId, targetId] of Object.entries(navButtons)) {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.switchMenuPage(targetId));
            }
        }

        // Bind all 'Back' buttons to return to root
        const backBtns = document.querySelectorAll('.back-btn');
        backBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-target');
                this.switchMenuPage(targetId || 'menu-root');
            });
        });
    }

    /**
     * Smoothly transitions between menu pages by toggling the active-page class.
     */
    switchMenuPage(targetPageId) {
        // Find all pages and remove active class
        const pages = document.querySelectorAll('.menu-page');
        pages.forEach(page => {
            page.classList.remove('active-page');
        });

        // Add active class to target page
        const targetPage = document.getElementById(targetPageId);
        if (targetPage) {
            targetPage.classList.add('active-page');
        }
    }

    /**
     * Resizes and initializes the circular radar canvas dimensions.
     */
    initRadarCanvas() {
        if (!this.radarCanvas) return;
        
        // Set static buffer size for polar coordinates
        this.radarCanvas.width = 120;
        this.radarCanvas.height = 120;
    }

    /**
     * Shows a full-screen transition slide when entering game loop.
     */
    showScreen(screenState) {
        // Hide all screens
        this.mainMenu.classList.add('hidden');
        this.gameHud.classList.add('hidden');
        this.gameOver.classList.add('hidden');
        
        const exitBtn = document.getElementById('exit-seat-container');
        if (exitBtn) exitBtn.classList.add('hidden');

        if (screenState === 'MENU') {
            this.mainMenu.classList.remove('hidden');
        } else if (screenState === 'PLAYING') {
            this.gameHud.classList.remove('hidden');
            
            // Trigger HUD bootup animation sequence
            this.gameHud.classList.remove('bootup-active');
            void this.gameHud.offsetWidth; // Force reflow
            this.gameHud.classList.add('bootup-active');

            if (exitBtn) exitBtn.classList.remove('hidden');
        } else if (screenState === 'GAMEOVER') {
            this.gameOver.classList.remove('hidden');
        }
    }

    /**
     * Fades in a large mid-screen announcement banner for new waves.
     */
    announceWave(waveNumber) {
        const el = document.getElementById('wave-announcement');
        const title = document.getElementById('wave-announce-title');
        
        if (!el || !title) return;

        title.textContent = `WAVE ${String(waveNumber).padStart(2, '0')}`;
        
        el.classList.remove('hidden');
        el.classList.remove('wave-announce-active');
        
        // Force reflow for css animations
        void el.offsetWidth;
        
        el.classList.add('wave-announce-active');
        setTimeout(() => {
            el.classList.add('hidden');
        }, 3500);
    }

    /**
     * Syncs ship health, shield, ammunition, and targeting coordinates with the HUD display.
     */
    updateHUD(player, enemiesCount) {
        // 1. Text Metrics
        if (this.waveVal) this.waveVal.textContent = String(player.waveNumber || 1).padStart(2, '0');
        if (this.enemiesVal) this.enemiesVal.textContent = String(enemiesCount);
        if (this.scoreVal) this.scoreVal.textContent = String(player.score).padStart(6, '0');
        if (this.multVal) this.multVal.textContent = `x${player.multiplier.toFixed(1)}`;

        // 2. Shield & Hull Fill Bars
        const shieldPercent = Math.round(player.shield);
        if (this.shieldFill) this.shieldFill.style.width = `${shieldPercent}%`;
        if (this.shieldPct) this.shieldPct.textContent = `${shieldPercent}%`;
        
        const hullPercent = Math.round(player.hull);
        if (this.hullFill) this.hullFill.style.width = `${hullPercent}%`;
        if (this.hullPct) this.hullPct.textContent = `${hullPercent}%`;

        // Pulse warning overlay if Hull/Shield are dangerously low (< 25%)
        if (player.hull <= 25 && player.hull > 0) {
            this.warningOverlay.classList.remove('hidden');
            this.warningOverlay.querySelector('.alert-message').textContent = 'WARNING: CRITICAL DAMAGE';
            this.warningOverlay.classList.add('warning-pulse-active');
        } else if (player.shield <= 0) {
            this.warningOverlay.classList.remove('hidden');
            this.warningOverlay.querySelector('.alert-message').textContent = 'WARNING: SHIELD DEFLT';
            this.warningOverlay.classList.add('warning-pulse-active');
        } else {
            this.warningOverlay.classList.add('hidden');
            this.warningOverlay.classList.remove('warning-pulse-active');
        }

        // 3. Segmented Boost indicator
        const activeSegments = Math.floor(player.boost / 20); // 5 segments total (20 each)
        this.boostSegments.forEach((segment, index) => {
            if (index < activeSegments) {
                segment.classList.add('active');
            } else {
                segment.classList.remove('active');
            }
        });

        // 4. Weapon Selection Widget
        const activeWeapon = player.weapons[player.activeWeaponIndex];
        if (this.weaponName) this.weaponName.textContent = activeWeapon.name;
        
        // Heat display
        if (this.energyFill) this.energyFill.style.width = `${player.energy}%`;
        
        // Overheat status text
        if (this.weaponReady) {
            if (player.energy >= 100) {
                this.weaponReady.textContent = 'OVERHEAT';
                this.weaponReady.style.color = 'var(--color-magenta)';
            } else {
                this.weaponReady.textContent = 'READY';
                this.weaponReady.style.color = 'var(--color-teal)';
            }
        }
    }

    /**
     * Shifts HTML absolute crosshair to align with aimed mouse values.
     */
    updateCrosshair(mouseX, mouseY) {
        if (!this.crosshair) return;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Convert normalized -1..+1 coordinates back to screen pixels
        const pixelX = (mouseX + 1) * 0.5 * width;
        const pixelY = (-mouseY + 1) * 0.5 * height;

        this.crosshair.style.left = `${pixelX}px`;
        this.crosshair.style.top = `${pixelY}px`;
    }

    /**
     * Renders a circular radar map with blinking enemy target points.
     */
    drawRadar(playerPos, enemyManager, asteroids) {
        if (!this.radarCtx) return;

        const ctx = this.radarCtx;
        const w = this.radarCanvas.width;
        const h = this.radarCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const maxRadarRange = 250; // Coordinates depth visibility limit

        // Clear canvas
        ctx.clearRect(0, 0, w, h);

        // 1. Radar background lines
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
        ctx.lineWidth = 1;
        
        // Draw outer ring border
        ctx.beginPath();
        ctx.arc(cx, cy, cx - 3, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw inner circular division ring
        ctx.beginPath();
        ctx.arc(cx, cy, (cx - 3) * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // Cross sector grid lines
        ctx.beginPath();
        ctx.moveTo(cx, 3); ctx.lineTo(cx, h - 3);
        ctx.moveTo(3, cy); ctx.lineTo(w - 3, cy);
        ctx.stroke();

        // 2. Blit blinking active enemies
        ctx.fillStyle = 'rgba(255, 0, 85, 0.85)'; // Red enemy color
        if (enemyManager && enemyManager.enemies) {
            enemyManager.enemies.forEach(enemy => {
                if (!enemy.active) return;
                
                // Relative displacement vector
                const dx = enemy.mesh.position.x - playerPos.x;
                const dz = enemy.mesh.position.z - playerPos.z; // Depth coordinate (distance out)

                // Scale relative values to fit inside 60px canvas radius
                // dx maps horizontally, dz maps vertically (inverted since enemies are in front: -z is up on radar)
                const radarX = cx + (dx / maxRadarRange) * cx;
                const radarY = cy + (dz / maxRadarRange) * cy;

                // Ensure dots stay inside outer radar ring boundaries
                const distFromCenter = Math.sqrt(Math.pow(radarX - cx, 2) + Math.pow(radarY - cy, 2));
                if (distFromCenter < cx - 6) {
                    ctx.beginPath();
                    ctx.arc(radarX, radarY, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        // 3. Draw player ship dot (Center)
        ctx.fillStyle = 'var(--color-teal)';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 4. Rotating sweep line
        this.radarSweepAngle += 0.05;
        ctx.strokeStyle = 'rgba(0, 255, 170, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
            cx + Math.cos(this.radarSweepAngle) * (cx - 3),
            cy + Math.sin(this.radarSweepAngle) * (cy - 3)
        );
        ctx.stroke();
    }

    /**
     * Renders scores on game over screens.
     */
    showGameOver(score, waves) {
        if (this.finalScore) this.finalScore.textContent = score;
        if (this.finalWave) this.finalWave.textContent = waves;
        this.showScreen('GAMEOVER');
    }
}
window.UIManager = UIManager;
