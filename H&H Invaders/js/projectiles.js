/**
 * H&H Invaders - Projectile Manager
 * Manages all active lasers, plasma spheres, and homing missiles fired by the player and enemies.
 * Calculates velocities, applies gravity warping, processes homing tracking, and handles collisions.
 */
class ProjectileManager {
    constructor(scene, effectsManager, audioSystem) {
        this.scene = scene;
        this.effectsManager = effectsManager;
        this.audioSystem = audioSystem;
        
        // Active projectile list
        this.projectiles = [];

        // Prebuilt shared geometries to avoid GC thrashing
        this.laserGeom = new THREE.CylinderGeometry(0.12, 0.12, 4.0, 4);
        this.laserGeom.rotateX(Math.PI / 2); // Align cylinder along z-axis
        
        this.rapidGeom = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 4);
        this.rapidGeom.rotateX(Math.PI / 2);

        this.plasmaGeom = new THREE.IcosahedronGeometry(1.0, 0); // 12 vertices instead of 256
        
        this.missileGeom = new THREE.CylinderGeometry(0.15, 0.25, 2.0, 6);
        this.missileGeom.rotateX(Math.PI / 2);

        // PBR removed to solve lag on iGPUs; MeshBasicMaterial relies purely on Bloom post-processing
        this.laserMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0033, transparent: true, opacity: 0.9 
        });  // Red Player Laser
        
        this.rapidMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ff88, transparent: true, opacity: 0.9 
        });  // Green Rapid Laser
        
        this.plasmaMat = new THREE.MeshBasicMaterial({ 
            color: 0x00f3ff, transparent: true, opacity: 0.85, wireframe: true 
        }); // Cyan Plasma
        
        this.missileMat = new THREE.MeshBasicMaterial({ 
            color: 0xff7700 
        }); // Orange Missile Tracker
        
        this.enemyMat = new THREE.MeshBasicMaterial({ 
            color: 0xff00ff, transparent: true, opacity: 0.9 
        });  // Magenta Enemy Laser
        
        // Pre-allocated object pool to prevent GC mid-combat
        this.meshPool = [];
    }

    /**
     * Retrieves an inactive mesh from the pool or allocates a new one.
     */
    getMeshFromPool(geom, mat) {
        for (let i = 0; i < this.meshPool.length; i++) {
            const m = this.meshPool[i];
            if (!m.visible && m.geometry === geom && m.material === mat) {
                m.visible = true;
                return m;
            }
        }
        
        const mesh = new THREE.Mesh(geom, mat);
        this.scene.add(mesh); // Add to scene exactly once
        this.meshPool.push(mesh);
        return mesh;
    }

    /**
     * Spawns a projectile in the game world.
     * @param {THREE.Vector3} position - Spawning coordinates
     * @param {THREE.Vector3} direction - Direction travel vector
     * @param {boolean} isPlayerOwned - True if fired by player, false if by enemy
     * @param {string} [type='LASER'] - Projectile weapon class (LASER, RAPID, PLASMA, MISSILE)
     * @param {number} [damage=10] - Damage rating of bullet
     */
    spawnProjectile(position, direction, isPlayerOwned, type = 'LASER', damage = 10) {
        let geom, mat, speed;
        const normalizedDir = new THREE.Vector3().copy(direction).normalize();

        // Configure projectile spec based on weapon selection
        if (!isPlayerOwned) {
            geom = this.laserGeom;
            mat = this.enemyMat;
            speed = 85;
        } else {
            switch (type) {
                case 'RAPID':
                    geom = this.rapidGeom;
                    mat = this.rapidMat;
                    speed = 180;
                    break;
                case 'PLASMA':
                    geom = this.plasmaGeom;
                    mat = this.plasmaMat;
                    speed = 70;
                    break;
                case 'MISSILE':
                    geom = this.missileGeom;
                    mat = this.missileMat;
                    speed = 45; // Starts slow, accelerates
                    break;
                case 'LASER':
                default:
                    geom = this.laserGeom;
                    mat = this.laserMat;
                    speed = 145;
                    break;
            }
        }

        const mesh = this.getMeshFromPool(geom, mat);
        mesh.position.copy(position);
        
        // Face travel direction
        mesh.lookAt(new THREE.Vector3().copy(position).add(normalizedDir));

        // Note: Dynamic PointLights removed here to eliminate severe shader recompilation lag on low-end CPUs!

        const velocity = new THREE.Vector3().copy(normalizedDir).multiplyScalar(speed);

        this.projectiles.push({
            mesh: mesh,
            velocity: velocity,
            isPlayerOwned: isPlayerOwned,
            type: type,
            damage: damage,
            radius: type === 'PLASMA' ? 1.2 : 0.4,
            life: type === 'PLASMA' ? 3.0 : 2.5, // Lifespan in seconds
            homingTarget: null, // Target references for homing missiles
            glowColor: isPlayerOwned ? (type === 'RAPID' ? 0x00ff88 : (type === 'PLASMA' ? 0x00f3ff : 0xff3333)) : 0xff00ff
        });
    }

    /**
     * Updates positions, homing paths, gravity curves, and lifetime timers.
     */
    update(deltaTime, gravitySystem, enemyManager) {
        const now = deltaTime;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            
            p.life -= now;

            // Delete dead bullets
            if (p.life <= 0 || p.mesh.position.z < -420 || p.mesh.position.z > 30) {
                this.destroyProjectile(i);
                continue;
            }

            // 1. Homing Missile steering logic (Phase 1 algorithm)
            if (p.type === 'MISSILE' && p.isPlayerOwned) {
                // Find target if none active
                if (!p.homingTarget || !p.homingTarget.active) {
                    p.homingTarget = this.findClosestTarget(p.mesh.position, enemyManager);
                }

                if (p.homingTarget && p.homingTarget.mesh) {
                    // Calculate vector towards target center
                    const steerDir = new THREE.Vector3().copy(p.homingTarget.mesh.position).sub(p.mesh.position).normalize();
                    
                    // Steer current velocity vector towards target using slerp/lerp
                    const speed = p.velocity.length();
                    const newDir = new THREE.Vector3().copy(p.velocity).normalize().lerp(steerDir, 4.5 * now).normalize();
                    p.velocity.copy(newDir).multiplyScalar(speed + 15 * now); // Accelerate missile
                    
                    // Adjust mesh look direction
                    p.mesh.lookAt(new THREE.Vector3().copy(p.mesh.position).add(newDir));
                }

                // Add puff trails
                if (Math.random() < 0.35) {
                    this.effectsManager.createSparks(p.mesh.position, new THREE.Vector3(0,0,-1).applyQuaternion(p.mesh.quaternion), 0xff7700, 1);
                }
            }

            // 2. Apply gravity curving pull
            const gForce = gravitySystem.calculateForce(p.mesh.position, 0.05); // Light bullet mass
            p.velocity.addScaledVector(gForce, now);

            // Update position
            p.mesh.position.addScaledVector(p.velocity, now);

            // Re-align meshes to match velocity curving paths
            if (p.type !== 'PLASMA') {
                const velDir = new THREE.Vector3().copy(p.velocity).normalize();
                p.mesh.lookAt(new THREE.Vector3().copy(p.mesh.position).add(velDir));
            }
        }
    }

    /**
     * Locates the closest active enemy spacecraft to steer missiles towards.
     */
    findClosestTarget(position, enemyManager) {
        if (!enemyManager || !enemyManager.enemies || enemyManager.enemies.length === 0) return null;

        let closest = null;
        let minDistSq = Infinity;

        enemyManager.enemies.forEach(enemy => {
            if (enemy.active) {
                const distSq = position.distanceToSquared(enemy.mesh.position);
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    closest = enemy;
                }
            }
        });

        return closest;
    }

    /**
     * Instantly deletes a projectile index.
     */
    destroyProjectile(index) {
        const p = this.projectiles[index];
        if (p) {
            // Return to object pool instead of deleting
            p.mesh.visible = false;
            this.projectiles.splice(index, 1);
        }
    }

    /**
     * Triggers collision impact, explosions, and sound alerts.
     */
    triggerImpact(index, collisionPos) {
        const p = this.projectiles[index];
        if (!p) return;

        if (p.type === 'PLASMA') {
            // Large plasma splash damage radius explosion
            this.effectsManager.createExplosion(collisionPos, 0x00f3ff, 20, 1.8);
            this.audioSystem.playExplosion(1.3);
        } else if (p.type === 'MISSILE') {
            this.effectsManager.createExplosion(collisionPos, 0xff7700, 16, 1.2);
            this.audioSystem.playExplosion(1.0);
        } else {
            // Small spark flash
            this.effectsManager.createSparks(collisionPos, new THREE.Vector3(0,0,1), p.glowColor, 8);
        }

        this.destroyProjectile(index);
    }

    /**
     * Clean all bullets from space.
     */
    clearAll() {
        this.projectiles.forEach(p => p.mesh.visible = false);
        this.projectiles = [];
    }
}
window.ProjectileManager = ProjectileManager;
