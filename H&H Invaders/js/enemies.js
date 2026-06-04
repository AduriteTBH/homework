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

        // Reusable low-poly geometries for Phase 1
        this.scoutGeom = new THREE.ConeGeometry(1.2, 2.5, 5);
        this.scoutGeom.rotateX(Math.PI / 2); // Point cone forward
        
        this.scoutMat = new THREE.MeshStandardMaterial({
            color: 0xef4444, // Bright crimson
            emissive: 0x991b1b,
            roughness: 0.5,
            metalness: 0.8,
            flatShading: true
        });
    }

    /**
     * Spawns a 3D grid block of enemy ships.
     * @param {number} waveNumber - Current wave difficulty modifier
     */
    spawnWave(waveNumber) {
        this.clearAll();
        
        this.waveNumber = waveNumber;
        this.gridOffset.set(0, 0, 0);
        this.direction = 1;

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
                const mesh = new THREE.Mesh(this.scoutGeom, this.scoutMat);
                
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
                    geometry: this.scoutGeom,
                    active: true,
                    health: 15 + waveNumber * 5,
                    maxHealth: 15 + waveNumber * 5,
                    radius: 2.2,
                    scoreValue: 100 * waveNumber,
                    // Store initial offset inside the fleet grid
                    gridLocalPos: new THREE.Vector3(x, y, z),
                    // Phase 2 properties placeholder
                    enemyType: 'Scout'
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
        
        // Fleet slowly descends towards player
        this.gridOffset.z += (2.5 + this.waveNumber * 0.5) * now;

        // Check horizontal boundary limits to reverse directions
        const maxXOffset = 45;
        if (Math.abs(this.gridOffset.x) > maxXOffset) {
            this.direction *= -1; // Reverse horizontal drift
            this.gridOffset.x = Math.max(-maxXOffset, Math.min(maxXOffset, this.gridOffset.x));
            // Shift down slightly on edge bounce
            this.gridOffset.z += 8.0;
        }

        // Apply grid coordinate offsets to all active enemies
        this.enemies.forEach(enemy => {
            if (enemy.active) {
                enemy.mesh.position.copy(enemy.gridLocalPos).add(this.gridOffset);
                
                // Slow ambient floating rotation
                enemy.mesh.rotation.y = Math.sin(Date.now() * 0.001 + enemy.gridLocalPos.x) * 0.15;
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

        // Choose random ship
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

    /**
     * Handles enemy ship damage.
     * @param {number} index - Index in enemies array
     * @param {number} damage - Damage applied
     */
    damageEnemy(index, damage) {
        const enemy = this.enemies[index];
        if (!enemy || !enemy.active) return false;

        enemy.health -= damage;

        // Visual flash (handled via brief scale pulse in Phase 1)
        enemy.mesh.scale.set(1.2, 1.2, 1.2);
        setTimeout(() => {
            if (enemy.mesh) enemy.mesh.scale.set(1, 1, 1);
        }, 80);

        if (enemy.health <= 0) {
            // Destroy ship
            enemy.active = false;
            
            // Explosion visual
            this.effectsManager.createExplosion(enemy.mesh.position, 0xef4444, 18, 1.3);
            this.audioSystem.playExplosion(0.85);

            this.scene.remove(enemy.mesh);
            enemy.geometry.dispose();
            
            this.enemies.splice(index, 1);
            this.enemiesCount = this.enemies.length;
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
            enemy.geometry.dispose();
        });
        this.enemies = [];
        this.enemiesCount = 0;
    }
}
window.EnemyManager = EnemyManager;
