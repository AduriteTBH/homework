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

        // Pre-generate a pool of beautiful procedural rocky materials with emissive crystal veins
        this.materialPool = [];
        this.initMaterialPool();
    }

    /**
     * Pre-generates canvas-based textures (bump maps, emissive mineral vein maps) for the asteroid pool.
     */
    initMaterialPool() {
        const colors = [
            0x6b7280, // Cool grey
            0x78716c, // Warm stone brown
            0x4b5563, // Dark slate basalt
            0x8c7864, // Sandy ochre
            0x57534e  // Dark granite
        ];

        // Cyan, pink, bright orange/gold, and radioactive green mineral veins
        const glowColors = ['#00f3ff', '#ec4899', '#f97316', '#22c55e'];

        for (let i = 0; i < 6; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            // Base grey/brown base
            ctx.fillStyle = '#374151';
            ctx.fillRect(0, 0, 256, 256);

            // Add fine rocky surface noise
            for (let j = 0; j < 700; j++) {
                const x = Math.random() * 256;
                const y = Math.random() * 256;
                const r = 1 + Math.random() * 4;
                const val = 25 + Math.floor(Math.random() * 65);
                ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw procedural craters (bump map circles with shadows & highlights)
            for (let j = 0; j < 7; j++) {
                const cx = Math.random() * 256;
                const cy = Math.random() * 256;
                const cr = 8 + Math.random() * 14;

                // Crater rim shadow (top-left offset)
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(cx - 3, cy - 3, cr, 0, Math.PI * 2);
                ctx.fill();

                // Crater rim highlight (bottom-right offset)
                ctx.fillStyle = '#9ca3af';
                ctx.beginPath();
                ctx.arc(cx + 3, cy + 3, cr, 0, Math.PI * 2);
                ctx.fill();

                // Crater basin
                ctx.fillStyle = '#1f2937';
                ctx.beginPath();
                ctx.arc(cx, cy, cr - 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw glowing crystal vein map
            const emissiveCanvas = document.createElement('canvas');
            emissiveCanvas.width = 256;
            emissiveCanvas.height = 256;
            const eCtx = emissiveCanvas.getContext('2d');
            eCtx.fillStyle = '#000000';
            eCtx.fillRect(0, 0, 256, 256);

            const veinColor = glowColors[i % glowColors.length];
            
            // Draw primary branching crystal lines
            eCtx.strokeStyle = veinColor;
            eCtx.lineWidth = 3 + Math.random() * 3;
            eCtx.lineCap = 'round';
            eCtx.lineJoin = 'round';
            
            eCtx.beginPath();
            let vx = Math.random() * 256;
            let vy = Math.random() * 256;
            eCtx.moveTo(vx, vy);
            for (let k = 0; k < 6; k++) {
                vx += (Math.random() - 0.5) * 80;
                vy += (Math.random() - 0.5) * 80;
                eCtx.lineTo(vx, vy);
            }
            eCtx.stroke();

            // Internal white core to make veins feel intensely hot/luminous
            eCtx.strokeStyle = '#ffffff';
            eCtx.lineWidth = 1.0;
            eCtx.stroke();

            const bumpMap = new THREE.CanvasTexture(canvas);
            const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);

            const mat = new THREE.MeshBasicMaterial({
                color: colors[i % colors.length],
                map: bumpMap
            });

            this.materialPool.push(mat);
        }
    }

    /**
     * Spawns a single asteroid at a randomized position far in front of the player.
     * @param {boolean} [randomZ=false] - True to distribute z position across full battlefield
     */
    spawnAsteroid(randomZ = false) {
        // High subdivisions to allow detailed organic terrain molding
        const geom = new THREE.DodecahedronGeometry(1, 2);
        
        // Deform vertices organically using sine/cosine combinations
        const posAttr = geom.getAttribute('position');
        const tempV = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
            tempV.fromBufferAttribute(posAttr, i);
            
            // Displace geometry using multiple layered wave frequencies for high-fidelity rock form
            const lengthScale = 0.76 + 
                                Math.sin(tempV.x * 2.8) * 0.12 + 
                                Math.cos(tempV.y * 2.8) * 0.12 + 
                                Math.sin(tempV.z * 2.8) * 0.08 +
                                Math.sin(tempV.x * 12.0 + tempV.y * 12.0) * 0.08;
            tempV.multiplyScalar(lengthScale);
            posAttr.setXYZ(i, tempV.x, tempV.y, tempV.z);
        }
        geom.computeVertexNormals();

        // Clone and slightly customize a pre-generated material
        const baseMat = this.materialPool[Math.floor(Math.random() * this.materialPool.length)];
        const mat = baseMat.clone();
        
        // Randomize the tone slightly to ensure color variation
        mat.color.offsetHSL(
            (Math.random() - 0.5) * 0.04, 
            (Math.random() - 0.5) * 0.1, 
            (Math.random() - 0.5) * 0.08
        );

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
