/**
 * H&H Invaders - Enemy Manager (Skeleton)
 * Responsible for wave formation layouts, spawning, grid translation updates,
 * firing enemy weapons, and exposing enemy hitboxes for collision detection.
 * 
 * Gemini 3.1 Pro will expand this in Phase 2 to add all 7 unique enemy classes,
 * custom procedural meshes, and complex dive-bombing attack scripts.
 */
class EnemyManager {
    constructor(scene, effectsManager, audioSystem, projectileManager) {
        this.scene = scene;
        this.effectsManager = effectsManager;
        this.audioSystem = audioSystem;
        this.projectileManager = projectileManager;

        // Active enemy array
        this.enemies = [];

        // Grid flight boundaries
        this.direction = 1; // 1: Right, -1: Left
        this.gridSpeed = 10;
        this.gridOffset = new THREE.Vector3(0, 0, 0);
        this.gridWidth = 100;
        this.gridHeight = 50;

        // Wave statistics
        this.waveNumber = 1;
        this.enemiesCount = 0;

        // Fire parameters
        this.fireInterval = 1.5;
        this.fireTimer = 0;

        // All materials use MeshBasicMaterial - no lighting calculations on integrated GPUs
        this.hullMat = new THREE.MeshBasicMaterial({ color: 0x555566 });
        this.wingMat = new THREE.MeshBasicMaterial({ color: 0xaa2222 });
        this.glassMat = new THREE.MeshBasicMaterial({ color: 0x001133 });
        this.engineMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        this.cannonMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        this.coreMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        // Reusable geometries for enemy ships (shared across all instances)
        this.bodyGeom = new THREE.CylinderGeometry(0.5, 1.2, 4.5, 6);
        this.bodyGeom.rotateX(Math.PI / 2);
        this.wingGeom = new THREE.BoxGeometry(6.0, 0.2, 2.0);
        this.cannonGeom = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 4);
        this.cannonGeom.rotateX(Math.PI / 2);
        this.glassGeom = new THREE.BoxGeometry(0.8, 0.7, 1.5);
        this.thrusterGeom = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 6);
        this.thrusterGeom.rotateX(Math.PI / 2);

        // Flash state tracker (replaces setTimeout)
        this.flashTimers = new Map();
    }

    /**
     * Constructs a procedural 3D Enemy Fighter model
     */
    buildScoutShip() {
        const group = new THREE.Group();
        
        // Main Fuselage - shared geometry
        const body = new THREE.Mesh(this.bodyGeom, this.hullMat);
        group.add(body);

        // Wings - shared geometry
        const wings = new THREE.Mesh(this.wingGeom, this.wingMat);
        wings.position.set(0, -0.3, 0.5);
        group.add(wings);
        
        // Wing tip cannons - shared geometry
        const leftCannon = new THREE.Mesh(this.cannonGeom, this.cannonMat);
        leftCannon.position.set(-2.8, -0.3, -0.5);
        const rightCannon = new THREE.Mesh(this.cannonGeom, this.cannonMat);
        rightCannon.position.set(2.8, -0.3, -0.5);
        group.add(leftCannon, rightCannon);

        // Cockpit canopy - shared geometry
        const glass = new THREE.Mesh(this.glassGeom, this.glassMat);
        glass.position.set(0, 0.6, -0.5);
        group.add(glass);

        // Dual Engine Thrusters - shared geometry, NO PointLights
        const thrusterL = new THREE.Mesh(this.thrusterGeom, this.engineMat);
        thrusterL.position.set(-0.6, 0, 2.2);
        const thrusterR = new THREE.Mesh(this.thrusterGeom, this.engineMat);
        thrusterR.position.set(0.6, 0, 2.2);
        group.add(thrusterL, thrusterR);
        
        return group;
    }

    /**
     * Constructs a massive 3D Boss Dreadnought
     */
    buildBossShip() {
        const group = new THREE.Group();
        
        // Massive Dreadnought Body
        const body = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 30), this.hullMat);
        group.add(body);

        // Core Bridge
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 10), this.glassMat);
        bridge.position.set(0, 3, 5);
        group.add(bridge);

        // Left/Right Wing Arrays
        const leftWing = new THREE.Mesh(new THREE.BoxGeometry(15, 1.5, 10), this.wingMat);
        leftWing.position.set(-15, 0, 5);
        const rightWing = new THREE.Mesh(new THREE.BoxGeometry(15, 1.5, 10), this.wingMat);
        rightWing.position.set(15, 0, 5);
        group.add(leftWing, rightWing);

        // Heavy Thrusters - shared geometry, NO PointLights
        const thrusterGeom = new THREE.CylinderGeometry(2.5, 3, 6, 8);
        thrusterGeom.rotateX(Math.PI / 2);
        const thruster1 = new THREE.Mesh(thrusterGeom, this.engineMat);
        thruster1.position.set(-6, 0, 16);
        const thruster2 = new THREE.Mesh(thrusterGeom, this.engineMat);
        thruster2.position.set(6, 0, 16);
        const thruster3 = new THREE.Mesh(thrusterGeom, this.engineMat);
        thruster3.position.set(0, 3, 16);
        group.add(thruster1, thruster2, thruster3);

        // Glowing weak point core - MeshBasicMaterial, no PointLight
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 0), this.coreMat);
        core.position.set(0, -1, 0);
        group.add(core);

        return group;
    }

    /**
     * Spawns the Dreadnought Boss Encounter
     */
    spawnBoss(waveNumber) {
        this.clearAll();
        this.waveNumber = waveNumber;
        this.gridOffset.set(0, 0, 0);
        this.direction = 1;
        this.gridSpeed = 15; // Faster strafing

        const mesh = this.buildBossShip();
        mesh.position.set(0, 15, -250); // Start far back
        mesh.lookAt(new THREE.Vector3(0, 15, 0));
        
        this.scene.add(mesh);

        this.enemies.push({
            mesh: mesh,
            active: true,
            health: 1500 + (waveNumber * 500), // Massive health pool
            maxHealth: 1500 + (waveNumber * 500),
            radius: 15.0, // Massive hitbox
            scoreValue: 5000 * waveNumber,
            gridLocalPos: new THREE.Vector3(0, 15, -120), // Target hover position
            enemyType: 'Boss'
        });

        this.enemiesCount = this.enemies.length;
        console.log(`WARNING! Dreadnought Boss spawned for Wave ${waveNumber}!`);
        
        // Broadcast boss event for UI
        const event = new CustomEvent('bossSpawned', { detail: { wave: waveNumber } });
        document.dispatchEvent(event);
    }

    /**
     * Spawns a 3D grid block of enemy ships.
     * @param {number} waveNumber - Current wave difficulty modifier
     */
    spawnWave(waveNumber) {
        if (waveNumber > 0 && waveNumber % 3 === 0) {
            this.spawnBoss(waveNumber);
            return;
        }

        this.clearAll();
        
        this.waveNumber = waveNumber;
        this.gridOffset.set(0, 0, 0);
        this.direction = 1;
        this.gridSpeed = 10; // Reset speed for normal wave

        // Scale grids based on wave count (max 4 rows, 8 columns)
        const cols = Math.min(8, 4 + waveNumber);
        const rows = Math.min(4, 2 + Math.floor(waveNumber / 2));
        
        const spacingX = 14;
        const spacingY = 10;
        
        const startX = -((cols - 1) * spacingX) / 2;
        const startY = 15;
        const startZ = -180; // Spawn distance in front

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const mesh = this.buildScoutShip();
                
                // Spice it up: Spawn Elite Interceptors randomly in later waves
                let isElite = false;
                if (waveNumber > 1 && Math.random() < (waveNumber * 0.08)) {
                    isElite = true;
                    // Tint the elite ship hull red for visual distinction
                    mesh.children.forEach(child => {
                        if (child.material === this.hullMat || child.material === this.wingMat) {
                            child.material = child.material.clone();
                            child.material.color.setHex(0xb91c1c); // Crimson red
                        }
                    });
                }
                
                // Position in grid
                const x = startX + c * spacingX;
                const y = startY + r * spacingY;
                const z = startZ - r * 5; // Layer depth slightly
                mesh.position.set(x, y, z);
                
                // Point towards player
                mesh.lookAt(new THREE.Vector3(x, y, 0));

                this.scene.add(mesh);

                this.enemies.push({
                    mesh: mesh,
                    active: true,
                    health: isElite ? (30 + waveNumber * 12) : (15 + waveNumber * 5),
                    maxHealth: isElite ? (30 + waveNumber * 12) : (15 + waveNumber * 5),
                    radius: 3.5, // Larger hitbox for the wide wings
                    scoreValue: isElite ? (300 * waveNumber) : (100 * waveNumber),
                    // Store initial offset inside the fleet grid
                    gridLocalPos: new THREE.Vector3(x, y, z),
                    enemyType: isElite ? 'Elite' : 'Scout'
                });
            }
        }

        this.enemiesCount = this.enemies.length;
        console.log(`Wave ${waveNumber} spawned. Fleet size: ${this.enemiesCount}`);
    }

    /**
     * Updates fleet position, lateral shifts, descends, and handles shooting.
     */
    update(deltaTime, playerPosition) {
        const now = deltaTime;

        // 1. Move Grid fleet
        // Grid shifts left/right
        this.gridOffset.x += this.direction * this.gridSpeed * now;
        
        const isBossWave = this.enemies.some(e => e.enemyType === 'Boss');

        if (!isBossWave) {
            // Fleet slowly descends towards player
            this.gridOffset.z += (2.5 + this.waveNumber * 0.5) * now;
        } else {
            // Boss smoothly glides to its target depth, then just strafes
            this.gridOffset.z = THREE.MathUtils.lerp(this.gridOffset.z, 0, 1.0 * now);
            
            // Adjust fire interval dynamically based on health
            const boss = this.enemies.find(e => e.enemyType === 'Boss');
            if (boss) {
                const healthRatio = boss.health / boss.maxHealth;
                this.fireInterval = 0.5 + (healthRatio * 1.0); // Shoots faster as health drops
            }
        }

        // Check horizontal boundary limits to reverse directions
        const maxXOffset = 45;
        if (Math.abs(this.gridOffset.x) > maxXOffset) {
            this.direction *= -1; // Reverse horizontal drift
            this.gridOffset.x = Math.max(-maxXOffset, Math.min(maxXOffset, this.gridOffset.x));
            if (!isBossWave) {
                // Shift down slightly on edge bounce
                this.gridOffset.z += 8.0;
            }
        }

        // Apply grid coordinate offsets to all active enemies
        // Update flash timers (replaces setTimeout, no GC pressure)
        const dt = Date.now();
        this.enemies.forEach(enemy => {
            if (enemy.active) {
                enemy.mesh.position.copy(enemy.gridLocalPos).add(this.gridOffset);
                
                // Flash reset logic
                if (enemy.flashUntil && dt > enemy.flashUntil) {
                    enemy.mesh.scale.set(1, 1, 1);
                    enemy.flashUntil = 0;
                }
                
                // Slow ambient floating rotation
                if (enemy.enemyType !== 'Boss') {
                    enemy.mesh.rotation.y = Math.sin(Date.now() * 0.001 + enemy.gridLocalPos.x) * 0.15;
                }
            }
        });

        // 2. Firing Cycle
        this.fireTimer += now;
        if (this.fireTimer >= this.fireInterval && this.enemies.length > 0) {
            this.fireTimer = 0;
            this.triggerEnemyFire();
        }
    }

    /**
     * Picks a random front-row enemy to fire a plasma laser at the player.
     */
    triggerEnemyFire() {
        const activeEnemies = this.enemies.filter(e => e.active);
        if (activeEnemies.length === 0) return;

        if (activeEnemies[0].enemyType === 'Boss') {
            const boss = activeEnemies[0];
            const bossPos = boss.mesh.position;
            // Fire 3 spread shots
            const dirs = [
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(-0.15, 0, 1).normalize(),
                new THREE.Vector3(0.15, 0, 1).normalize()
            ];
            dirs.forEach(d => {
                // Alternating between laser and plasma for boss
                const type = Math.random() > 0.5 ? 'PLASMA' : 'LASER';
                this.projectileManager.spawnProjectile(
                    new THREE.Vector3(bossPos.x, bossPos.y - 2, bossPos.z + 10),
                    d,
                    false, // Enemy
                    type,
                    25
                );
            });
            return;
        }

        // Choose a random subset of ships to fire a volley (2 to 4 ships at once)
        const volleyCount = Math.min(activeEnemies.length, Math.floor(Math.random() * 3) + 2);
        
        for (let i = 0; i < volleyCount; i++) {
            const shooter = activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
            const nozzle = new THREE.Vector3().copy(shooter.mesh.position);
            
            // Target player position (aim slightly ahead or centered)
            const targetPos = new THREE.Vector3(
                (Math.random() - 0.5) * 20, 
                (Math.random() - 0.5) * 10, 
                0
            );

            const dir = new THREE.Vector3().copy(targetPos).sub(nozzle).normalize();

            // Spawn magenta projectile
            this.projectileManager.spawnProjectile(nozzle, dir, false, 'LASER', 10);
        }
    }

    /**
     * Handles enemy ship damage.
     * @param {number} index - Index in enemies array
     * @param {number} damage - Damage applied
     */
    damageEnemy(index, damage) {
        const enemy = this.enemies[index];
        if (!enemy || !enemy.active) return false;

        enemy.health -= damage;

        // Visual flash - set flag, resolved in update loop (no setTimeout GC pressure)
        enemy.mesh.scale.set(1.2, 1.2, 1.2);
        enemy.flashUntil = Date.now() + 80;

        if (enemy.health <= 0) {
            // Destroy ship
            enemy.active = false;
            
            const isBoss = enemy.enemyType === 'Boss';
            const explosionScale = isBoss ? 5.0 : 1.0;
            const explosionParticles = isBoss ? 5 : 4; // Hard capped for GPU safety

            // Explosion visual
            this.effectsManager.createExplosion(enemy.mesh.position, 0xef4444, explosionParticles, explosionScale);
            this.audioSystem.playExplosion(isBoss ? 2.5 : 0.85);

            this.scene.remove(enemy.mesh);
            
            this.enemies.splice(index, 1);
            this.enemiesCount = this.enemies.length;
            
            if (isBoss) {
                const event = new CustomEvent('bossDefeated');
                document.dispatchEvent(event);
            }
            return true; // Enemy destroyed
        }

        return false;
    }

    /**
     * Clean all enemy ships.
     */
    clearAll() {
        this.enemies.forEach(enemy => {
            this.scene.remove(enemy.mesh);
        });
        this.enemies = [];
        this.enemiesCount = 0;
    }
}
window.EnemyManager = EnemyManager;
