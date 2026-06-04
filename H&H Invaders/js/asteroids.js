/**
 * H&H Invaders - Asteroids Manager
 * Handles the generation, updating, object pooling, and collision bounds
 * of low-poly rocky asteroids drifting through the combat sector.
 */
class AsteroidManager {
    constructor(scene, effectsManager) {
        this.scene = scene;
        this.effectsManager = effectsManager;
        
        // Active asteroid objects
        this.asteroids = [];
        
        // Maximum active asteroids
        this.maxAsteroids = 45;
        this.spawnTimer = 0;
        this.spawnInterval = 0.8; // Spawn/recycle tick rate in seconds

        // Build base geometry reference
        this.baseGeom = new THREE.DodecahedronGeometry(1, 1);
    }

    /**
     * Spawns a single asteroid at a randomized position far in front of the player.
     * @param {boolean} [randomZ=false] - True to distribute z position across full battlefield
     */
    spawnAsteroid(randomZ = false) {
        // Procedurally deform geometry to make each asteroid unique
        const geom = this.baseGeom.clone();
        
        // Displace vertices randomly
        const posAttr = geom.getAttribute('position');
        const tempV = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
            tempV.fromBufferAttribute(posAttr, i);
            // Push vertex outwards or inwards randomly
            const lengthScale = 0.8 + Math.random() * 0.45;
            tempV.multiplyScalar(lengthScale);
            posAttr.setXYZ(i, tempV.x, tempV.y, tempV.z);
        }
        geom.computeVertexNormals();

        // Create a flat-shaded rocky grey/brown material
        const hue = 0.05 + Math.random() * 0.05; // Slightly brown/grey
        const sat = 0.1 + Math.random() * 0.15;
        const light = 0.2 + Math.random() * 0.2;
        const color = new THREE.Color().setHSL(hue, sat, light);

        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.95,
            metalness: 0.05,
            flatShading: true
        });

        const mesh = new THREE.Mesh(geom, mat);
        
        // Scale size (1.5 to 7.0 units wide)
        const size = 1.5 + Math.pow(Math.random(), 2.0) * 5.5;
        mesh.scale.set(size, size, size);

        // Position far in front of player
        const spawnX = (Math.random() - 0.5) * 220;
        const spawnY = (Math.random() - 0.5) * 140;
        const spawnZ = randomZ ? -50 - Math.random() * 300 : -350;

        mesh.position.set(spawnX, spawnY, spawnZ);

        // Drift speed (z direction: towards player) and rotation vectors
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 4,
            12 + Math.random() * 20 // Drift z velocity
        );

        const rotSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5,
            (Math.random() - 0.5) * 1.5
        );

        // Bounding Sphere for collision checks
        const colRadius = size * 0.95;

        this.scene.add(mesh);
        
        this.asteroids.push({
            mesh: mesh,
            geometry: geom,
            velocity: velocity,
            rotationSpeed: rotSpeed,
            radius: colRadius,
            health: Math.ceil(size * 4) // Armor scales with size
        });
    }

    /**
     * Initial spawn sequence when entering game.
     */
    initAsteroidField() {
        this.clearAll();
        for (let i = 0; i < this.maxAsteroids; i++) {
            this.spawnAsteroid(true); // Distribute z randomly
        }
    }

    /**
     * Updates positions, applies gravity pull, and handles recycling.
     * @param {number} deltaTime - Time elapsed since last frame
     * @param {GravitySystem} gravitySystem - Gravity calculation engine
     */
    update(deltaTime, gravitySystem) {
        const now = deltaTime;

        // 1. Move active asteroids
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const ast = this.asteroids[i];
            
            // Apply drift
            ast.mesh.position.addScaledVector(ast.velocity, now);

            // Apply gravity warping (asteroids have massive inertia, so apply low scaling)
            const gForce = gravitySystem.calculateForce(ast.mesh.position, ast.radius * 2);
            ast.velocity.addScaledVector(gForce, now);

            // Apply rotation
            ast.mesh.rotation.x += ast.rotationSpeed.x * now;
            ast.mesh.rotation.y += ast.rotationSpeed.y * now;
            ast.mesh.rotation.z += ast.rotationSpeed.z * now;

            // Recycling: if asteroid passes behind the cockpit camera, wrap it to the back
            if (ast.mesh.position.z > 20) {
                this.recycleAsteroid(ast);
            }
        }

        // 2. Replenish count if beneath limit
        if (this.asteroids.length < this.maxAsteroids) {
            this.spawnTimer += now;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnAsteroid();
                this.spawnTimer = 0;
            }
        }
    }

    /**
     * Recycles a passed asteroid to the front of the screen.
     */
    recycleAsteroid(asteroid) {
        asteroid.mesh.position.set(
            (Math.random() - 0.5) * 220,
            (Math.random() - 0.5) * 140,
            -350
        );
        asteroid.velocity.set(
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 4,
            12 + Math.random() * 20
        );
        asteroid.health = Math.ceil(asteroid.mesh.scale.x * 4);
    }

    /**
     * Handles laser hit damage.
     * @param {number} index - Index in the active asteroid array
     * @param {number} damage - Damage value to apply
     */
    damageAsteroid(index, damage) {
        const ast = this.asteroids[index];
        if (!ast) return false;

        ast.health -= damage;
        
        // Trigger impact sparks
        this.effectsManager.createSparks(ast.mesh.position, new THREE.Vector3(0,0,-1), 0xaaaaaa, 6);

        if (ast.health <= 0) {
            // Spawn large rocky explosion
            this.effectsManager.createExplosion(ast.mesh.position, 0x555555, 12, ast.mesh.scale.x * 0.4);
            
            // Clean up node
            this.scene.remove(ast.mesh);
            ast.geometry.dispose();
            this.asteroids.splice(index, 1);
            return true; // Destroyed
        }
        return false; // Damaged but alive
    }

    /**
     * Clears all asteroid nodes.
     */
    clearAll() {
        this.asteroids.forEach(ast => {
            this.scene.remove(ast.mesh);
            ast.geometry.dispose();
        });
        this.asteroids = [];
    }
}
window.AsteroidManager = AsteroidManager;
