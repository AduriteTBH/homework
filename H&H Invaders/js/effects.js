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
        
        // Geometries reusable pools to save memory and draw calls
        this.particleGeom = new THREE.DodecahedronGeometry(0.3, 0); // Stylized rocky chunks
        this.sparkGeom = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        this.shieldGeom = new THREE.SphereGeometry(1, 12, 12);
    }

    /**
     * Spawns a stylized explosion at target.
     * @param {THREE.Vector3} position - Explosion origin
     * @param {number} colorHex - Hexadecimal color of particles
     * @param {number} [count=25] - Number of particles to spawn
     * @param {number} [scale=1.0] - Scaling factor for explosion size
     */
    createExplosion(position, colorHex, count = 25, scale = 1.0) {
        const material = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.particleGeom, material);
            
            // Random position offset in a small sphere
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5
            ).multiplyScalar(scale);
            
            mesh.position.copy(position).add(offset);
            
            // Scaled size
            const size = (0.3 + Math.random() * 0.7) * scale;
            mesh.scale.set(size, size, size);

            // Exploding outwards velocity vector
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            ).addScaledVector(offset, 5); // Add directional bias from offset

            const rotationSpeed = new THREE.Vector3(
                Math.random() * 10,
                Math.random() * 10,
                Math.random() * 10
            );

            this.scene.add(mesh);
            
            this.particles.push({
                mesh: mesh,
                velocity: velocity,
                rotationSpeed: rotationSpeed,
                color: colorHex,
                life: 1.0,                    // 100% life
                decay: 1.5 + Math.random() * 1.5 // Decay rate per second
            });
        }
    }

    /**
     * Creates a spark blast representing bullet impacts or weapon discharges.
     */
    createSparks(position, direction, colorHex, count = 8) {
        const material = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 1.0
        });

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.sparkGeom, material);
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

            this.scene.add(mesh);
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

        const mesh = new THREE.Mesh(this.shieldGeom, mat);
        mesh.position.copy(position);
        mesh.scale.set(radius, radius, radius);

        this.scene.add(mesh);
        
        this.shieldFlashes.push({
            mesh: mesh,
            life: 1.0,
            decay: 5.0 // Extremely fast fade
        });
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
                // Remove mesh from scene
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                this.particles.splice(i, 1);
            } else {
                // Fade opacity and slightly scale down
                p.mesh.material.opacity = p.life;
                const currentScale = p.mesh.scale.x;
                p.mesh.scale.multiplyScalar(1 - 0.2 * now);
            }
        }

        // 2. Update Shield Flashes
        for (let i = this.shieldFlashes.length - 1; i >= 0; i--) {
            const sf = this.shieldFlashes[i];
            sf.life -= sf.decay * now;

            if (sf.life <= 0) {
                this.scene.remove(sf.mesh);
                sf.mesh.geometry.dispose();
                this.shieldFlashes.splice(i, 1);
            } else {
                sf.mesh.material.opacity = sf.life * 0.7;
                // Slightly expand shield bubble during flash
                sf.mesh.scale.addScalar(1.5 * now);
            }
        }
    }

    /**
     * Clears all remaining visual nodes from the screen.
     */
    clearAll() {
        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.shieldFlashes.forEach(sf => this.scene.remove(sf.mesh));
        
        this.particles = [];
        this.shieldFlashes = [];
    }
}
window.EffectsManager = EffectsManager;
