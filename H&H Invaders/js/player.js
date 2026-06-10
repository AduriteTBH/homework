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
        
        // Screen shake effect
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        
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
        const frameMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 60 });
        const trimMat = new THREE.MeshPhongMaterial({ color: 0x334155, shininess: 100 });

        // Glowing pipeline/button materials
        const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const greenGlow = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
        const orangeGlow = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const redGlow = new THREE.MeshBasicMaterial({ color: 0xff0055 });

        // Left & Right tilted consoles
        const leftConsole = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.5), frameMat);
        leftConsole.position.set(-2.4, -2.0, -2.2);
        leftConsole.rotation.set(0.2, 0.5, -0.15);
        this.cockpitGroup.add(leftConsole);

        const rightConsole = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.5), frameMat);
        rightConsole.position.set(2.4, -2.0, -2.2);
        rightConsole.rotation.set(0.2, -0.5, 0.15);
        this.cockpitGroup.add(rightConsole);

        // Center console main desk
        const centerConsole = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 1.2), frameMat);
        centerConsole.position.set(0, -2.2, -2.4);
        centerConsole.rotation.x = 0.15;
        this.cockpitGroup.add(centerConsole);

        // Tilted holographic/glass screen meshes
        const glassMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });

        const screenLeft = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), glassMaterial);
        screenLeft.position.set(-2.0, -1.3, -2.0);
        screenLeft.rotation.set(0.15, 0.55, -0.1);
        this.cockpitGroup.add(screenLeft);

        const screenRight = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), glassMaterial);
        screenRight.position.set(2.0, -1.3, -2.0);
        screenRight.rotation.set(0.15, -0.55, 0.1);
        this.cockpitGroup.add(screenRight);

        // Tilted HUD screen border frames
        const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.6, 0.9));
        const borderMat = new THREE.LineBasicMaterial({ color: 0x00f3ff });
        const leftScreenBorder = new THREE.LineSegments(borderGeo, borderMat);
        leftScreenBorder.position.copy(screenLeft.position);
        leftScreenBorder.rotation.copy(screenLeft.rotation);
        this.cockpitGroup.add(leftScreenBorder);

        const rightScreenBorder = new THREE.LineSegments(borderGeo, borderMat);
        rightScreenBorder.position.copy(screenRight.position);
        rightScreenBorder.rotation.copy(screenRight.rotation);
        this.cockpitGroup.add(rightScreenBorder);

        // Add 3D control buttons on the left console
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 2; j++) {
                const btnGeo = new THREE.BoxGeometry(0.1, 0.05, 0.1);
                const colors = [greenGlow, orangeGlow, cyanGlow, redGlow];
                const btnMat = colors[(i + j) % colors.length];
                const btn = new THREE.Mesh(btnGeo, btnMat);
                btn.position.set(-2.9 + i * 0.25, -1.5, -2.3 + j * 0.25);
                btn.rotation.set(0.2, 0.5, -0.15);
                this.cockpitGroup.add(btn);
            }
        }

        // Add 3D rotary dials on the right console
        for (let i = 0; i < 3; i++) {
            const dialGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8);
            const dial = new THREE.Mesh(dialGeo, trimMat);
            dial.position.set(2.2 + i * 0.35, -1.5, -2.2);
            dial.rotation.set(0.5, -0.5, 0.15);
            
            const dialPointerGeo = new THREE.BoxGeometry(0.02, 0.06, 0.06);
            const dialPointer = new THREE.Mesh(dialPointerGeo, cyanGlow);
            dialPointer.position.set(0, 0.03, 0);
            dial.add(dialPointer);
            
            this.cockpitGroup.add(dial);
        }

        // Add Flight Yoke / Steering columns
        const yokeColumnGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
        const yokeColumn = new THREE.Mesh(yokeColumnGeo, trimMat);
        yokeColumn.position.set(0, -1.9, -1.9);
        yokeColumn.rotation.x = -0.5; // Angled towards player
        this.cockpitGroup.add(yokeColumn);

        const yokeHandleGeo = new THREE.TorusGeometry(0.25, 0.04, 8, 24, Math.PI); // Half-wheel yoke
        const yokeHandle = new THREE.Mesh(yokeHandleGeo, trimMat);
        yokeHandle.position.set(0, -1.5, -1.7);
        yokeHandle.rotation.set(0.5, 0, Math.PI / 2);
        this.cockpitGroup.add(yokeHandle);

        const yokeGripL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8), frameMat);
        yokeGripL.position.set(0.25, 0.0, 0.0);
        yokeHandle.add(yokeGripL);

        const yokeGripR = yokeGripL.clone();
        yokeGripR.position.x = -0.25;
        yokeHandle.add(yokeGripR);

        // Canopy Framework (windshield metal struts)
        // Left main canopy frame strut
        const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.0, 0.2), trimMat);
        leftFrame.position.set(-3.2, 0.2, -2.8);
        leftFrame.rotation.set(0.15, 0, -0.28);
        this.cockpitGroup.add(leftFrame);

        // Right main canopy frame strut
        const rightFrame = leftFrame.clone();
        rightFrame.position.x = 3.2;
        rightFrame.rotation.z = 0.28;
        this.cockpitGroup.add(rightFrame);

        // Lower dash trim line (neon glowing pipeline running across)
        const trimBar = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.04, 0.04), cyanGlow);
        trimBar.position.set(0, -1.7, -2.35);
        this.cockpitGroup.add(trimBar);

        // Top windshield frame bar
        const topFrameBar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 0.2), trimMat);
        topFrameBar.position.set(0, 2.3, -2.6);
        this.cockpitGroup.add(topFrameBar);

        // Center strut running up the center window
        const centerStrut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), trimMat);
        centerStrut.position.set(0, -1.1, -2.4);
        centerStrut.rotation.x = -0.2;
        this.cockpitGroup.add(centerStrut);
    }

    /**
     * Switches the active weapon system slot.
     */
    selectWeapon(index, playSound = true) {
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
        if (playSound) {
            this.audioSystem.playWarningAlarm();
        }
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

        // Play damage hit sound
        this.audioSystem.playHit();
        
        // Trigger camera screen shake based on damage amount
        this.shakeTime = 0.5;
        this.shakeIntensity = Math.min(amount * 0.05, 2.0); // Cap max shake intensity

        // Spawn some sparks or warning effect (Throttled to prevent lag from continuous damage)
        if (amount > 5.0 || Math.random() < 0.1) {
            this.scene.effects.createExplosion(this.position, 0xff0000, 10, 2.0);
        }
        
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
    update(deltaTime, keys, mouseX, mouseY, gravitySystem) {
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
        
        // Apply Gravitational Pull from Planets!
        if (gravitySystem) {
            const gravForce = gravitySystem.calculateForce(this.position, 1.0);
            gravForce.z = 0; // CRITICAL: Prevent Z-axis movement so player doesn't drift ahead of enemies
            // Multiply the gravitational force to overcome engine drag if close enough
            this.velocity.addScaledVector(gravForce, now * 25.0); 
        }

        // Lerp current ship velocity to target inputs (simulating engine thrust fighting gravity)
        this.velocity.lerp(moveVector, 8 * now);
        this.velocity.z = 0; // Clamp velocity Z
        this.position.addScaledVector(this.velocity, now);
        this.position.z = 0; // Hard lock Z to prevent breaking collision planes
        this.position.x = THREE.MathUtils.clamp(this.position.x, this.minBounds.x, this.maxBounds.x);
        this.position.y = THREE.MathUtils.clamp(this.position.y, this.minBounds.y, this.maxBounds.y);

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

        // Apply screen shake if active
        if (this.shakeTime > 0) {
            this.shakeTime -= now;
            if (this.shakeTime < 0) this.shakeTime = 0;
            const intensity = this.shakeIntensity * (this.shakeTime / 0.5); // Decay over time
            this.camera.position.x += (Math.random() - 0.5) * intensity;
            this.camera.position.y += (Math.random() - 0.5) * intensity;
        }

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
        this.selectWeapon(1, false);
        this.cockpitGroup.visible = true; // Show cockpit in flight mode
    }
}
window.PlayerShip = PlayerShip;
