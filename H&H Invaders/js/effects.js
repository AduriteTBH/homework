/**
 * H&H Invaders - Effects Manager
 * Manages low-cost, high-performance visual effects like low-poly particle explosions,
 * glowing shield hit flashes, weapon fire sparks, and engine trails.
 */
class EffectsManager {
    constructor(scene) {
        this.scene = scene;
        
        // Active visual arrays
        this.particles = [];
        this.shieldFlashes = [];
        this.speedLines = [];
        
        // Geometries reusable pools to save memory and draw calls
        this.particleGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3); // Replaced Dodecahedron for performance
        this.sparkGeom = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        this.shieldGeom = new THREE.IcosahedronGeometry(1, 0); // Low-poly icosahedron instead of sphere
        this.shockwaveGeom = new THREE.RingGeometry(0.8, 1, 16); // Flat 2D ring instead of 3D wireframe sphere
        
        // Pre-allocated object pool for visual effects
        this.meshPool = [];
    }

    /**
     * Retrieves an inactive mesh from the pool or allocates a new one.
     */
    getMeshFromPool(geom) {
        for (let i = 0; i < this.meshPool.length; i++) {
            const m = this.meshPool[i];
            if (!m.visible && m.geometry === geom) {
                m.visible = true;
                return m;
            }
        }
        
        const mesh = new THREE.Mesh(geom);
        this.scene.add(mesh); // Add to scene exactly once
        this.meshPool.push(mesh);
        return mesh;
    }

    /**
     * Spawns a cinematic explosion with shockwaves and debris.
     * @param {THREE.Vector3} position - Explosion origin
     * @param {number} colorHex - Hexadecimal color of particles
     * @param {number} [count=25] - Number of particles to spawn
     * @param {number} [scale=1.0] - Scaling factor for explosion size
     */
    createExplosion(position, colorHex, count = 25, scale = 1.0) {
        // Protect low-end hardware (like AMD A4) by strictly capping max active particles
        if (this.particles.length > 60) return;
        
        // 1. Shockwave Ripple
        const swMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide, // Ensure ring is visible from both sides
            blending: THREE.AdditiveBlending
        });
        const shockwave = this.getMeshFromPool(this.shockwaveGeom);
        shockwave.material = swMat;
        shockwave.position.copy(position);
        
        // Orient ring to face camera along Z axis roughly
        shockwave.lookAt(new THREE.Vector3(position.x, position.y, position.z + 100));
        shockwave.scale.set(scale, scale, scale);
        
        // Push shockwave into the shieldFlashes array since they both expand and fade
        this.shieldFlashes.push({
            mesh: shockwave,
            life: 1.0,
            decay: 2.0,
            expansionRate: 25.0 * scale // Fast expansion
        });

        // 2. High-intensity debris chunks
        const material = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });

        // Cap explosion particle count severely for integrated GPUs
        const optimizedCount = Math.min(count, 5);

        for (let i = 0; i < optimizedCount; i++) {
            const mesh = this.getMeshFromPool(this.particleGeom);
            mesh.material = material;
            
            // Random position offset in a small sphere
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5
            ).multiplyScalar(scale);
            
            mesh.position.copy(position).add(offset);
            
            // Scaled size
            const size = (0.3 + Math.random() * 1.0) * scale;
            mesh.scale.set(size, size, size);

            // Exploding outwards velocity vector with high initial blast
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40,
                (Math.random() - 0.5) * 40
            ).addScaledVector(offset, 10);

            const rotationSpeed = new THREE.Vector3(
                Math.random() * 15,
                Math.random() * 15,
                Math.random() * 15
            );
            
            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                rotationSpeed: rotationSpeed,
                color: colorHex,
                life: 1.0,
                decay: 1.0 + Math.random() * 1.5 // Slower decay for debris
            });
        }
    }

    /**
     * Creates a spark blast representing bullet impacts or weapon discharges.
     */
    createSparks(position, direction, colorHex, count = 3) {
        const material = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 1.0
        });

        for (let i = 0; i < count; i++) {
            const mesh = this.getMeshFromPool(this.sparkGeom);
            mesh.material = material;
            mesh.position.copy(position);
            
            // Vector pointing in general direction with random dispersion
            const velocity = new THREE.Vector3().copy(direction)
                .normalize()
                .multiplyScalar(25)
                .add(new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ));

            // Align mesh rotation to velocity direction
            mesh.lookAt(new THREE.Vector3().copy(position).add(velocity));

            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                rotationSpeed: new THREE.Vector3(0,0,0),
                color: colorHex,
                life: 1.0,
                decay: 3.5 + Math.random() * 2.0
            });
        }
    }

    /**
     * Spawns a glowing shield bubble flash on impact.
     */
    createShieldFlash(position, radius, colorHex = 0x00f3ff) {
        const mat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            wireframe: true // Low-poly wireframe bubble
        });

        const mesh = this.getMeshFromPool(this.shieldGeom);
        mesh.material = mat;
        mesh.position.copy(position);
        mesh.scale.set(radius, radius, radius);
        
        this.shieldFlashes.push({
            mesh: mesh,
            life: 1.0,
            decay: 5.0, // Extremely fast fade
            expansionRate: 1.5
        });
    }

    /**
     * Spawns speed line streaks when boosting.
     */
    createSpeedLines(camera) {
        if (this.speedLines.length > 60) return; // Cap maximum speed lines

        const material = new THREE.LineBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.8
        });

        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 5 + Math.random() * 20; // Spread around camera
            
            // Start way ahead in the local z-axis (far plane)
            const startZ = -150 - Math.random() * 50;
            const endZ = startZ + 40 + Math.random() * 30; // Length of the line

            // X/Y offsets based on angle
            const xOffset = Math.cos(angle) * distance;
            const yOffset = Math.sin(angle) * distance;

            // Local coordinates relative to camera
            const points = [
                new THREE.Vector3(xOffset, yOffset, startZ),
                new THREE.Vector3(xOffset, yOffset, endZ)
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);

            // Add the line as a child of the camera so it follows perfectly
            camera.add(line);

            this.speedLines.push({
                mesh: line,
                speed: 300 + Math.random() * 200, // Very fast local +Z speed
                life: 1.0,
                camera: camera
            });
        }
    }

    /**
     * Iterates frame states of all active particles and flashes.
     * Applies velocity, optional gravity, decays life, updates scales and opacities.
     * @param {number} deltaTime - Time elapsed since last frame
     * @param {GravitySystem} [gravitySystem] - Optional physics gravity grid
     */
    update(deltaTime, gravitySystem) {
        const now = deltaTime;

        // 1. Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Physics: Update positions
            p.mesh.position.addScaledVector(p.velocity, now);
            
            // Apply gravity drift if active
            if (gravitySystem) {
                const gravityPull = gravitySystem.calculateForce(p.mesh.position, 0.2); // Light mass
                p.velocity.addScaledVector(gravityPull, now);
            }

            // Apply rotation
            p.mesh.rotation.x += p.rotationSpeed.x * now;
            p.mesh.rotation.y += p.rotationSpeed.y * now;
            
            // Decay life
            p.life -= p.decay * now;

            if (p.life <= 0) {
                // Return mesh to pool instead of removing
                p.mesh.visible = false;
                this.particles.splice(i, 1);
            } else {
                // Fade opacity and slightly scale down
                p.mesh.material.opacity = p.life;
                const currentScale = p.mesh.scale.x;
                p.mesh.scale.multiplyScalar(1 - 0.2 * now);
            }
        }

        // 2. Update Shield Flashes & Shockwaves
        for (let i = this.shieldFlashes.length - 1; i >= 0; i--) {
            const sf = this.shieldFlashes[i];
            sf.life -= sf.decay * now;

            if (sf.life <= 0) {
                // Return to pool
                sf.mesh.visible = false;
                this.shieldFlashes.splice(i, 1);
            } else {
                sf.mesh.material.opacity = sf.life * 0.7;
                // Dynamically expand based on optional expansionRate
                const expansion = sf.expansionRate || 1.5;
                sf.mesh.scale.addScalar(expansion * now);
            }
        }

        // 3. Update Speed Lines
        for (let i = this.speedLines.length - 1; i >= 0; i--) {
            const sl = this.speedLines[i];
            
            // Move locally towards the camera along local Z axis
            sl.mesh.position.z += sl.speed * now;
            
            sl.life -= 1.0 * now;

            // If the line passes behind the camera (Z > 150) or life is over, remove it
            if (sl.mesh.position.z > 150 || sl.life <= 0) {
                sl.camera.remove(sl.mesh);
                // BufferGeometries created per line, so these CAN be disposed
                sl.mesh.geometry.dispose();
                this.speedLines.splice(i, 1);
            } else {
                sl.mesh.material.opacity = sl.life * 0.8;
            }
        }
    }

    /**
     * Clears all remaining visual nodes from the screen.
     */
    clearAll() {
        this.particles.forEach(p => p.mesh.visible = false);
        this.shieldFlashes.forEach(sf => sf.mesh.visible = false);
        this.speedLines.forEach(sl => {
            sl.camera.remove(sl.mesh);
            sl.mesh.geometry.dispose();
        });
        
        this.particles = [];
        this.shieldFlashes = [];
        this.speedLines = [];
    }
}
window.EffectsManager = EffectsManager;
