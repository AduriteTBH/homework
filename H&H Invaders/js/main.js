/**
 * H&H Invaders - Main Game Application
 * Master manager that binds and coordinates all game systems.
 * Tracks global state (MENU, PLAYING, GAMEOVER), gathers keyboard/mouse inputs,
 * executes physics collision sweeps, and governs wave progressions.
 */
class GameApp {
    constructor() {
        this.gameState = 'MENU'; // States: MENU, PLAYING, GAMEOVER

        // Core systems instances
        this.audio = new AudioSystem();
        this.sceneMgr = new SceneManager('game-container');
        
        // Secondary subsystems
        this.gravity = new GravitySystem();
        this.effects = new EffectsManager(this.sceneMgr.scene);
        this.planets = new EnvironmentManager(this.sceneMgr.scene, this.gravity);
        this.asteroids = new AsteroidManager(this.sceneMgr.scene, this.effects);
        this.projectiles = new ProjectileManager(this.sceneMgr.scene, this.effects, this.audio);
        
        this.player = new PlayerShip(
            this.sceneMgr.scene,
            this.sceneMgr.camera,
            this.projectiles,
            this.audio,
            this.effects
        );
        
        this.enemies = new EnemyManager(
            this.sceneMgr.scene,
            this.effects,
            this.audio,
            this.projectiles
        );
        
        this.interior = new InteriorManager(
            this.sceneMgr.scene,
            this.sceneMgr.camera,
            this.audio
        );
        
        this.ui = new UIManager();

        // Inputs trackers
        this.keys = {};
        this.mouseX = 0; // Normalized -1 to +1
        this.mouseY = 0; // Normalized -1 to +1
        
        // Loop controls
        this.clock = new THREE.Clock();
        this.maxDelta = 0.1; // Cap delta to prevent physics blowout on tab sleep

        // Hardware Auto-Detect for Low-End Devices (Chromebooks, mobile)
        window.isLowEndDevice = false;
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
            window.isLowEndDevice = true;
            console.warn("Low-end hardware detected (<= 4 cores). Applying aggressive optimizations.");
        }
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            window.isLowEndDevice = true;
        }

        // Apply low-end render scale
        if (window.isLowEndDevice && this.sceneMgr && this.sceneMgr.renderer) {
            this.sceneMgr.renderer.setPixelRatio(1.0); // Override retina screens
        }

        // Start initialization pipelines
        this.bindEvents();

        // Pre-warm the GPU shaders asynchronously to allow the loading screen to render first
        setTimeout(() => {
            this.prewarmGPU();
        }, 100);

        this.animate();
    }

    /**
     * Binds keyboard, mouse tracking, and UI button clicks.
     */
    bindEvents() {
        // 1. Keyboard Tracking (WASD and weapon switching)
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;

            // Prevent spacebar from clicking focused HTML buttons (which restarts the game)
            if (e.key === ' ') {
                e.preventDefault();
            }

            // Weapon slots hotkeys (1-5)
            if (key >= '1' && key <= '5' && this.gameState === 'PLAYING') {
                this.player.selectWeapon(parseInt(key));
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
        });

        // 2. Custom Game Events
        document.addEventListener('bossDefeated', () => {
            // Endless Mode: Do NOT trigger victory! Let the game continue.
            // Reward the player with massive points and a repair instead.
            this.player.score += 10000 * this.player.multiplier;
            this.player.shield = this.player.maxShield; // Full shield recharge
            this.player.hull = Math.min(this.player.maxHull, this.player.hull + 40); // 40% hull repair
            this.audio.playBootUp(); // Play victory jingle as a wave-clear sound
        });

        // 2. Mouse Aiming coordinate tracking
        window.addEventListener('mousemove', (e) => {
            // Map pixel coordinates to normalized device coordinates: -1.0 to +1.0
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1; // Invert Y
        });

        // 3. Mouse Weapon Trigger clicks
        window.addEventListener('mousedown', (e) => {
            if (this.gameState !== 'PLAYING') return;

            // If player clicked with primary/secondary
            if (e.button === 0) { // Left click
                if (this.player.activeWeaponIndex === 5) {
                    this.player.setBeamState(true);
                } else {
                    this.player.fireWeapon();
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0 && this.player.activeWeaponIndex === 5) {
                this.player.setBeamState(false);
            }
        });

        // 4. DOM Button Clicks (Start and Restart)
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
        }

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }
        
        const exitSeatBtn = document.getElementById('btn-exit-seat');
        if (exitSeatBtn) {
            exitSeatBtn.addEventListener('click', () => this.transitionToWalking());
        }
        
        // Add keyboard shortcut for F to exit seat
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'f' || e.key === 'F') && this.gameState === 'PLAYING') {
                this.transitionToWalking();
            }
        });
    }

    /**
     * Silently spawns all visual effect variants far off-camera to force WebGL shader compilation,
     * preventing mid-combat stuttering on low-end Chromebooks.
     */
    prewarmGPU() {
        const offCameraPos = new THREE.Vector3(0, -9999, 0);
        const dummyDir = new THREE.Vector3(0, 1, 0);

        // 1. Fire projectiles
        this.projectiles.spawnProjectile(offCameraPos, dummyDir, true, 'LASER');
        this.projectiles.spawnProjectile(offCameraPos, dummyDir, true, 'PLASMA');
        this.projectiles.spawnProjectile(offCameraPos, dummyDir, true, 'RAPID');
        this.projectiles.spawnProjectile(offCameraPos, dummyDir, true, 'MISSILE');
        this.projectiles.spawnProjectile(offCameraPos, dummyDir, false, 'LASER');

        // 2. Fire Effects (Explosions, Shields, Sparks)
        this.effects.createExplosion(offCameraPos, 0x00f3ff, 5, 1.0); // Boss/Plasma color
        this.effects.createExplosion(offCameraPos, 0xff7700, 5, 1.0); // Missile color
        this.effects.createExplosion(offCameraPos, 0xff3333, 5, 1.0); // Enemy ship color
        this.effects.createExplosion(offCameraPos, 0x555555, 5, 1.0); // Asteroid color
        
        this.effects.createShieldFlash(offCameraPos, 1.0, 0x00f3ff);
        this.effects.createSparks(offCameraPos, dummyDir, 0xff00ff, 5);

        // 3. Force Renderer Compile (The game will freeze for ~100ms here as WebGL compiles shaders)
        if (this.sceneMgr && this.sceneMgr.renderer) {
            this.sceneMgr.renderer.compile(this.sceneMgr.scene, this.sceneMgr.camera);
        }

        // 4. Return items to object pools immediately
        this.projectiles.clearAll();
        this.effects.clearAll();

        // 5. Hide loading screen, reveal main menu smoothly
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            document.getElementById('loading-status').innerText = "SYSTEMS NOMINAL. READY.";
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.classList.add('hidden');
                    loadingScreen.classList.remove('active');
                }, 800);
            }, 300);
        }
    }

    /**
     * Initializes stats, unlocks browser audio context, and launches spaceship walking cabin.
     */
    startGame() {
        this.audio.init();

        this.gameState = 'WALKING';
        this.ui.showScreen('WALKING'); // Hides menu overlays, exposes canvas
        
        this.projectiles.clearAll();
        this.effects.clearAll();
        this.enemies.clearAll();
        this.asteroids.clearAll();
        
        // Explicitly hide cockpit struts during walking phase by removing them from camera
        if (this.player && this.player.cockpitGroup) {
            this.player.cockpitGroup.visible = false;
            this.sceneMgr.camera.remove(this.player.cockpitGroup);
        }
        
        // Enter walk phase
        this.interior.enter();
    }

    /**
     * Transitions from cockpit seat interaction into space flight combat mode.
     */
    transitionToFlight() {
        this.gameState = 'PLAYING';
        this.ui.showScreen('PLAYING'); // Exposes flight HUD meters
        
        // Reset player metrics
        this.player.reset();
        this.player.waveNumber = 1;

        // Explicitly show cockpit struts during flight combat
        if (this.player && this.player.cockpitGroup) {
            this.player.cockpitGroup.visible = true;
            this.sceneMgr.camera.add(this.player.cockpitGroup);
        }
        
        // Spawn combat grid & asteroids
        this.asteroids.initAsteroidField();
        this.enemies.spawnWave(1);
        this.ui.announceWave(1);
    }

    /**
     * Transitions from space flight combat mode back to the walking interior phase.
     */
    transitionToWalking() {
        if (this.gameState !== 'PLAYING') return;

        this.gameState = 'WALKING';
        this.ui.showScreen('WALKING'); // Hides flight HUD

        // Hide cockpit struts
        if (this.player && this.player.cockpitGroup) {
            this.player.cockpitGroup.visible = false;
            this.sceneMgr.camera.remove(this.player.cockpitGroup);
        }

        // Reset camera and character to interior mode
        this.interior.enter(true); // Pass true to stand up with sit_to idle transition
    }

    /**
     * Re-initializes system variables for subsequent attempts.
     */
    restartGame() {
        this.projectiles.clearAll();
        this.effects.clearAll();
        this.enemies.clearAll();
        this.asteroids.clearAll();
        this.interior.exit();
        this.startGame();
    }

    /**
     * Iterates to next wave level, scaling difficulties.
     */
    triggerNextWave() {
        this.player.waveNumber++;
        this.projectiles.clearAll();
        
        // Spawn subsequent wave
        this.enemies.spawnWave(this.player.waveNumber);
        this.ui.announceWave(this.player.waveNumber);
        
        // Recharge some player shield as progress bonus
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + 30);
    }

    /**
     * Shifts engine states to Game Over.
     */
    triggerGameOver() {
        this.gameState = 'GAMEOVER';
        this.player.setBeamState(false);
        this.audio.setBeamSoundActive(false);
        
        // Save final variables to scoreboard
        this.ui.showGameOver(this.player.score, this.player.waveNumber - 1);
    }

    /**
     * Triggers the Victory Screen when the Boss is defeated
     */
    triggerVictory() {
        this.gameState = 'MENU';
        this.audio.playBootUp(); // Victory sound
        
        const rootMenu = document.getElementById('menu-root');
        if (rootMenu) {
            rootMenu.innerHTML = `
                <h1 style="color: #00f3ff; font-family: 'Orbitron'; font-size: 60px; text-shadow: 0 0 20px #00f3ff; text-align: center;">MISSION ACCOMPLISHED</h1>
                <p class="subtitle" style="text-align: center; font-size: 24px;">The Dreadnought Boss has been destroyed!</p>
                <div class="menu-buttons" style="margin-top: 50px;">
                    <button onclick="location.reload()" class="tech-btn primary-btn" style="width: 300px;">PLAY AGAIN</button>
                </div>
            `;
            document.getElementById('main-menu').classList.remove('hidden');
            document.getElementById('main-menu').classList.add('active');
            document.getElementById('game-hud').classList.add('hidden');
            
            // Release pointer lock
            document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
            if (document.exitPointerLock) document.exitPointerLock();
        }
    }

    /**
     * Bounding collision checking sweeps across weapons, asteroids, and targets.
     */
    processCollisions() {
        // Cache projectile array lengths
        const projs = this.projectiles.projectiles;
        const enemies = this.enemies.enemies;
        const asts = this.asteroids.asteroids;

        // 1. Sweep Player Lasers vs Enemies & Asteroids
        for (let i = projs.length - 1; i >= 0; i--) {
            const p = projs[i];
            let hitRegistered = false;

            if (p.isPlayerOwned) {
                // Check Enemy Hits
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    if (!enemy.active) continue;

                    const dist = p.mesh.position.distanceTo(enemy.mesh.position);
                    const hitRange = p.radius + enemy.radius;

                    if (dist < hitRange) {
                        // Collision!
                        this.projectiles.triggerImpact(i, p.mesh.position);
                        hitRegistered = true;

                        // Deal Damage
                        const killed = this.enemies.damageEnemy(j, p.damage);
                        if (killed) {
                            // Increment Score with Multiplier
                            const pointsGained = enemy.scoreValue * this.player.multiplier;
                            this.player.score += Math.round(pointsGained);
                            this.player.multiplier = Math.min(5.0, this.player.multiplier + 0.1);
                        }
                        break;
                    }
                }

                if (hitRegistered) continue;

                // Check Asteroid Hits
                for (let k = asts.length - 1; k >= 0; k--) {
                    const ast = asts[k];
                    const dist = p.mesh.position.distanceTo(ast.mesh.position);
                    const hitRange = p.radius + ast.radius;

                    if (dist < hitRange) {
                        this.projectiles.triggerImpact(i, p.mesh.position);
                        hitRegistered = true;

                        const destroyed = this.asteroids.damageAsteroid(k, p.damage);
                        if (destroyed) {
                            this.player.score += Math.round(50 * this.player.multiplier);
                        }
                        break;
                    }
                }
            } else {
                // 2. Sweep Enemy Lasers vs Player Ship
                const playerColPos = new THREE.Vector3(0, 0, -3.5).applyMatrix4(this.player.camera.matrixWorld);
                const dist = p.mesh.position.distanceTo(playerColPos);
                
                if (dist < p.radius + 3.2) { // Player hitbox sphere approx 3.2 units
                    this.projectiles.triggerImpact(i, p.mesh.position);
                    
                    // Hurt player
                    this.player.takeDamage(p.damage);
                    this.player.multiplier = 1.0; // Reset score mult chain
                }
            }
        }

        // 3. Sweep Player Ship vs Asteroids
        const shipPos = this.player.position;
        for (let k = asts.length - 1; k >= 0; k--) {
            const ast = asts[k];
            // Only check asteroids that are very close (Z coordinate near player plane)
            if (ast.mesh.position.z > -25 && ast.mesh.position.z < 5) {
                const dist = shipPos.distanceTo(ast.mesh.position);
                
                if (dist < ast.radius + 3.0) { // Cockpit width collision check
                    // Blow up asteroid
                    this.effects.createExplosion(ast.mesh.position, 0x555555, 15, ast.mesh.scale.x * 0.45);
                    this.audio.playExplosion(1.1);

                    this.player.takeDamage(Math.ceil(ast.radius * 4.5));
                    this.player.multiplier = 1.0;

                    // Remove asteroid nodes
                    this.sceneMgr.scene.remove(ast.mesh);
                    ast.geometry.dispose();
                    asts.splice(k, 1);
                }
            }
        }

        // 4. Sweep bypassed Enemies (Enemies passing the player cockpit)
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (enemy.active && enemy.mesh.position.z > 6.0) {
                // Enemy bypassed defense line!
                this.player.takeDamage(20);
                this.player.multiplier = 1.0;
                
                // Silently delete enemy from list without points
                enemy.active = false;
                this.sceneMgr.scene.remove(enemy.mesh);
                enemies.splice(j, 1);
                this.enemies.enemiesCount = enemies.length;
            }
        }
    }

    /**
     * Master frame animation clock callback.
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // Get delta time and clamp for safety
        let dt = this.clock.getDelta();
        if (dt > this.maxDelta) dt = this.maxDelta;

        // FPS calculation update
        if (!this.fpsFrameCount) {
            this.fpsFrameCount = 0;
            this.fpsLastTime = performance.now();
            this.fpsElement = document.getElementById('fps-counter');
        }
        this.fpsFrameCount++;
        const nowTime = performance.now();
        if (nowTime >= this.fpsLastTime + 1000) {
            const fps = Math.round((this.fpsFrameCount * 1000) / (nowTime - this.fpsLastTime));
            if (this.fpsElement) {
                this.fpsElement.textContent = `FPS: ${fps}`;
            }
            this.fpsFrameCount = 0;
            this.fpsLastTime = nowTime;
        }

        if (this.gameState === 'WALKING') {
            // Update spaceship walking mechanics
            this.interior.update(dt, this.keys);
        } else if (this.gameState === 'PLAYING') {
            // 1. Update flight stats
            this.player.update(dt, this.keys, this.mouseX, this.mouseY, this.gravity);
            
            if (this.player.isBoosting) {
                this.effects.createSpeedLines(this.sceneMgr.camera);
            }
            
            // 2. Update entities arrays
            this.asteroids.update(dt, this.gravity);
            this.enemies.update(dt, this.player.position);
            this.projectiles.update(dt, this.gravity, this.enemies);
            
            // 3. Process collision checks
            this.processCollisions();

            // 3.5. Process Planetary Atmospheric Death Zones
            if (this.planets && this.planets.planets) {
                for (const p of this.planets.planets) {
                    if (p.userData.isLethalPlanet) {
                        // 1. Check Player
                        const dist = this.player.position.distanceTo(p.position);
                        if (dist < p.userData.deathRadius) {
                            // Massive hull damage (deadly winds)
                            this.player.takeDamage(150 * dt);
                        }

                        // 2. Check Enemies (Planets act as massive natural hazards!)
                        const enemiesArr = this.enemies.enemies;
                        for (let j = enemiesArr.length - 1; j >= 0; j--) {
                            const enemy = enemiesArr[j];
                            if (enemy.active) {
                                const eDist = enemy.mesh.position.distanceTo(p.position);
                                if (eDist < p.userData.deathRadius) {
                                    // Enemy gets shredded by the atmosphere
                                    this.effects.createExplosion(enemy.mesh.position, 0xff5500, 20, enemy.radius * 0.6);
                                    if (enemy.enemyType !== 'Boss') { // Bosses probably shouldn't insta-die, but let's let it happen for fun, or maybe just take damage.
                                        enemy.active = false;
                                        this.sceneMgr.scene.remove(enemy.mesh);
                                        enemiesArr.splice(j, 1);
                                        this.enemies.enemiesCount = enemiesArr.length;
                                    } else {
                                        // Boss just takes heavy damage
                                        enemy.health -= 500 * dt;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 4. Check wave completion
            if (this.enemies.enemiesCount <= 0) {
                this.triggerNextWave();
            }

            // 5. Check player defeat
            if (this.player.hull <= 0) {
                this.triggerGameOver();
            }

            // 6. UI refresh bindings
            this.ui.updateHUD(this.player, this.enemies.enemiesCount);
            this.ui.updateCrosshair(this.mouseX, this.mouseY);
            this.ui.drawRadar(this.player.position, this.enemies, this.asteroids.asteroids);

            // 7. Boss HUD Sync
            const boss = this.enemies.enemies.find(e => e.enemyType === 'Boss');
            const bossBarContainer = document.getElementById('hud-boss-bar');
            if (boss && boss.active) {
                bossBarContainer.classList.remove('hidden');
                const bossHealthFill = document.getElementById('boss-health-fill');
                const bossHealthText = document.getElementById('boss-health-text');
                const pct = Math.max(0, (boss.health / boss.maxHealth) * 100);
                bossHealthFill.style.width = `${pct}%`;
                bossHealthText.innerText = `${Math.floor(pct)}%`;
            } else {
                bossBarContainer.classList.add('hidden');
            }
        }

        // Always render background orbital movements and visual particles
        this.planets.update(dt);
        this.effects.update(dt, this.gravity);
        
        // Pass player velocity relative shift to stars
        this.sceneMgr.update(dt, this.player.velocity);

        // Commit rendering frame
        this.sceneMgr.render();
    }
}

// Safe initialization that avoids load-event race conditions
const initGame = () => {
    if (!window.gameApp) {
        window.gameApp = new GameApp();
    }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initGame();
} else {
    window.addEventListener('DOMContentLoaded', initGame);
}
