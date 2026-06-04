/**
 * H&H Invaders - Player Ship
 * Manages player statistics (shield, hull, boost, energy, active weapon, score, multiplier),
 * controls keyboard/mouse strafe boundaries, renders the cockpit frame group,
 * and handles fire rates and weapon selectors.
 */
class PlayerShip {
    constructor(scene, camera, projectileManager, audioSystem, effectsManager) {
        this.scene = scene;
        this.camera = camera;
        this.projectileManager = projectileManager;
        this.audioSystem = audioSystem;
        this.effectsManager = effectsManager;

        // Player statistics
        this.maxShield = 100;
        this.shield = 100;
        this.maxHull = 100;
        this.hull = 100;
        
        this.maxBoost = 100;
        this.boost = 100;
        this.isBoosting = false;
        
        this.maxEnergy = 100;
        this.energy = 100; // Weapon Heat/Energy
        this.score = 0;
        this.multiplier = 1.0;

        // Weapon Configuration
        this.activeWeaponIndex = 1; // 1: Laser, 2: Rapid, 3: Plasma, 4: Missile, 5: Beam
        this.weapons = {
            1: { name: 'PRIMARY LASER', damage: 12, fireRate: 0.22, cost: 0, heatGen: 0 },
            2: { name: 'RAPID FIRE', damage: 6, fireRate: 0.08, cost: 0, heatGen: 8 },
            3: { name: 'PLASMA CANNON', damage: 65, fireRate: 0.75, cost: 0, heatGen: 28 },
            4: { name: 'MISSILE LAUNCHER', damage: 45, fireRate: 0.55, cost: 0, heatGen: 20 },
            5: { name: 'CHARGED BEAM', damage: 4, fireRate: 0.03, cost: 0, heatGen: 30 } // tick damage
        };
        this.fireCooldown = 0;
        this.beamActive = false;

        // Positioning limits (confined fight space)
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        this.minBounds = new THREE.Vector2(-35, -20);
        this.maxBounds = new THREE.Vector2(35, 20);
        
        this.baseSpeed = 40.0;
        this.boostMultiplier = 2.0;
        this.brakeMultiplier = 0.3;

        // Aiming vector targets
        this.aimTarget = new THREE.Vector3(0, 0, -100);
        this.cockpitSwayOffset = new THREE.Vector3(0, 0, 0);

        // 3D Cockpit base group
        this.cockpitGroup = new THREE.Group();
        this.camera.add(this.cockpitGroup); // Lock cockpit to camera movement
        this.scene.add(this.camera);

        this.initCockpitPlaceholder();
        this.cockpitGroup.visible = false; // Hidden initially during walking phase
    }

    /**
     * Constructs a basic 3D cockpit placeholder structure.
     * Pro will expand this in Phase 2 into a high-fidelity panel assembly.
     */
    initCockpitPlaceholder() {
        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b, // Dark grey metal
            metalness: 0.9,
            roughness: 0.2,
            flatShading: true
        });

        const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff }); // Cyan light pipelines

        // Create basic left, right, and bottom boundary struts for visual containment
        const leftStrut = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), frameMat);
        leftStrut.position.set(-3.2, -1, -3);
        leftStrut.rotation.z = -0.3;
        this.cockpitGroup.add(leftStrut);

        const rightStrut = leftStrut.clone();
        rightStrut.position.x = 3.2;
        rightStrut.rotation.z = 0.3;
        this.cockpitGroup.add(rightStrut);

        const bottomConsole = new THREE.Mesh(new THREE.BoxGeometry(7, 1.2, 1.0), frameMat);
        bottomConsole.position.set(0, -2.4, -2.5);
        this.cockpitGroup.add(bottomConsole);

        // Neon border strip placeholders
        const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.05), lightMat);
        neonStrip.position.set(0, -1.78, -2.48);
        this.cockpitGroup.add(neonStrip);
    }

    /**
     * Switches the active weapon system slot.
     */
    selectWeapon(index) {
        if (index < 1 || index > 5) return;
        
        // Turn off continuous beam if switching away
        if (this.activeWeaponIndex === 5 && index !== 5) {
            this.setBeamState(false);
        }

        this.activeWeaponIndex = index;
        
        // Highlight active key in HUD (handled in UI)
        document.querySelectorAll('.weapon-key').forEach(el => el.classList.remove('active'));
        const activeKey = document.getElementById(`wk-${index}`);
        if (activeKey) activeKey.classList.add('active');

        // Play weapon switch tick sound
        this.audioSystem.playWarningAlarm();
    }

    /**
     * Toggles continuous charged beam states.
     */
    setBeamState(active) {
        this.beamActive = active;
        this.audioSystem.setBeamSoundActive(active);
    }

    /**
     * Discharges weapon systems based on trigger conditions.
     */
    fireWeapon() {
        if (this.fireCooldown > 0) return;

        const w = this.weapons[this.activeWeaponIndex];

        // Heat cooling restrictions
        if (this.activeWeaponIndex !== 1 && this.energy >= 100) {
            // Weapon overheated warning beep
            this.audioSystem.playWarningAlarm();
            return;
        }

        // Calculate gun nozzle spawn positions (alternating left/right sides of cockpit)
        const leftNozzle = new THREE.Vector3(-1.8, -0.6, -2.5).applyMatrix4(this.camera.matrixWorld);
        const rightNozzle = new THREE.Vector3(1.8, -0.6, -2.5).applyMatrix4(this.camera.matrixWorld);
        const spawnPos = (Math.random() < 0.5) ? leftNozzle : rightNozzle;

        // Direction vector from nozzle pointing to 3D aiming target
        const dir = new THREE.Vector3().copy(this.aimTarget).sub(spawnPos).normalize();

        // Spawn appropriate projectile
        if (this.activeWeaponIndex === 5) {
            // Charged beam (tick mode)
            this.projectileManager.spawnProjectile(spawnPos, dir, true, 'LASER', w.damage);
            this.energy = Math.min(100, this.energy + w.heatGen * 0.1);
        } else {
            const types = { 1: 'LASER', 2: 'RAPID', 3: 'PLASMA', 4: 'MISSILE' };
            this.projectileManager.spawnProjectile(spawnPos, dir, true, types[this.activeWeaponIndex], w.damage);

            // Generate heat (Primary weapon 1 is infinite/no heat)
            if (this.activeWeaponIndex !== 1) {
                this.energy = Math.min(100, this.energy + w.heatGen);
            }

            // Play synthesis sounds
            if (this.activeWeaponIndex === 1) this.audioSystem.playLaser();
            else if (this.activeWeaponIndex === 2) this.audioSystem.playRapidFire();
            else if (this.activeWeaponIndex === 3) this.audioSystem.playPlasma();
            else if (this.activeWeaponIndex === 4) this.audioSystem.playMissile();
        }

        // Set cooldown timer
        this.fireCooldown = w.fireRate;
    }

    /**
     * Deducts health/shield metrics and shakes cockpit.
     */
    takeDamage(amount) {
        // Trigger shield impact flash
        const localShieldPos = new THREE.Vector3(0, 0, -3).applyMatrix4(this.camera.matrixWorld);
        this.effectsManager.createShieldFlash(localShieldPos, 5, this.shield > 0 ? 0x00f3ff : 0xff0055);

        if (this.shield > 0) {
            this.shield -= amount;
            if (this.shield < 0) {
                this.hull += this.shield; // Overflow to hull
                this.shield = 0;
            }
        } else {
            this.hull = Math.max(0, this.hull - amount);
        }

        // Play alert warn beep
        this.audioSystem.playWarningAlarm();

        // Apply screen shake css classes
        const hud = document.getElementById('game-hud');
        if (hud) {
            hud.classList.add('shake-active');
            setTimeout(() => hud.classList.remove('shake-active'), 350);
        }
    }

    /**
     * Process flight inputs, boundaries, status regenerations, and aim sway.
     */
    update(deltaTime, keys, mouseX, mouseY) {
        const now = deltaTime;

        // 1. Cooldown / Energy Cooling
        if (this.fireCooldown > 0) {
            this.fireCooldown -= now;
        }

        // Passive heat cooling if not firing continuous beam
        if (!this.beamActive && this.energy > 0) {
            this.energy = Math.max(0, this.energy - 35 * now); // cool rate
        }

        // Passive shield recharge (if shield is not fully destroyed)
        if (this.shield < this.maxShield && this.hull > 0) {
            this.shield = Math.min(this.maxShield, this.shield + 4 * now);
        }

        // 2. Flight Strafe Input Parsing
        let speed = this.baseSpeed;
        
        // Boost parsing
        this.isBoosting = keys[' '] && this.boost > 0;
        if (this.isBoosting) {
            speed *= this.boostMultiplier;
            this.boost = Math.max(0, this.boost - 40 * now); // Consume boost
        } else {
            this.boost = Math.min(this.maxBoost, this.boost + 15 * now); // Recharge boost
        }

        // Space Brake parsing
        if (keys['shift'] && !this.isBoosting) {
            speed *= this.brakeMultiplier;
        }

        // Calculate strafing movement vectors
        const moveVector = new THREE.Vector3(0, 0, 0);
        if (keys['a']) moveVector.x = -1;
        if (keys['d']) moveVector.x = 1;
        if (keys['w']) moveVector.y = 1;
        if (keys['s']) moveVector.y = -1;

        moveVector.normalize().multiplyScalar(speed);
        
        // Lerp current ship velocity to target inputs
        this.velocity.lerp(moveVector, 8 * now);
        this.position.addScaledVector(this.velocity, now);

        // Clamp positions to combat sector boundaries
        this.position.x = Math.max(this.minBounds.x, Math.min(this.maxBounds.x, this.position.x));
        this.position.y = Math.max(this.minBounds.y, Math.min(this.maxBounds.y, this.position.y));

        // Align camera coordinates to player coordinate
        this.camera.position.x = this.position.x;
        this.camera.position.y = this.position.y;
        this.camera.position.z = 0; // Fixed Z

        // 3. Aiming coordinate calculations
        // Map mouse -1 to +1 coordinate space into a 3D target point on far projection plane (z = -100)
        const targetX = this.position.x + mouseX * 60;
        const targetY = this.position.y + mouseY * 40;
        this.aimTarget.set(targetX, targetY, -100);

        // Turn camera slightly to face the target to simulate vehicle steering
        const lookPos = new THREE.Vector3().copy(this.aimTarget);
        // Dampen camera rotation lookAt
        const camTargetLook = new THREE.Vector3(0, 0, -40).applyMatrix4(this.camera.matrixWorld);
        camTargetLook.lerp(lookPos, 6 * now);
        this.camera.lookAt(camTargetLook);

        // 4. Cockpit Sway Math (Lag slightly behind aiming mouse coordinate changes)
        const targetSwayX = -mouseX * 0.28;
        const targetSwayY = -mouseY * 0.18;
        
        this.cockpitSwayOffset.x = THREE.MathUtils.lerp(this.cockpitSwayOffset.x, targetSwayX, 7 * now);
        this.cockpitSwayOffset.y = THREE.MathUtils.lerp(this.cockpitSwayOffset.y, targetSwayY, 7 * now);
        
        this.cockpitGroup.position.set(this.cockpitSwayOffset.x, this.cockpitSwayOffset.y, 0);

        // 5. Update engine audio synthesizer parameters
        const speedFactor = this.velocity.length() / (this.baseSpeed * this.boostMultiplier);
        this.audioSystem.updateEngineSound(speedFactor, this.isBoosting);

        // Continuous beam trigger tick rate
        if (this.beamActive) {
            this.fireWeapon();
        }
    }

    /**
     * Resets player ship values for new matches.
     */
    reset() {
        this.shield = this.maxShield;
        this.hull = this.maxHull;
        this.boost = this.maxBoost;
        this.energy = 0;
        this.score = 0;
        this.multiplier = 1.0;
        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.selectWeapon(1);
        this.cockpitGroup.visible = true; // Show cockpit in flight mode
    }
}
window.PlayerShip = PlayerShip;
