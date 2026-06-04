/**
 * H&H Invaders - Gravity System
 * Computes gravitational pull fields exerted by massive planetary bodies in space
 * to warp projectile paths, pull drifting debris, and slightly steer the player ship.
 */
class GravitySystem {
    constructor() {
        this.bodies = []; // List of { mesh, mass, radius }
        this.G = 0.8;      // Game-tuned gravitational constant (not NASA realistic, but arcade-fun)
    }

    /**
     * Registers a massive planetary body in the gravity grid.
     * @param {THREE.Mesh} mesh - The planetary sphere mesh
     * @param {number} mass - The gravity weight multiplier
     * @param {number} radius - Boundary radius of the planet
     */
    addBody(mesh, mass, radius) {
        this.bodies.push({
            mesh: mesh,
            mass: mass,
            radius: radius
        });
        console.log(`Planetary gravity body added: Mass ${mass}, Radius ${radius}`);
    }

    /**
     * Removes a gravity body (useful during scene resets).
     */
    clear() {
        this.bodies = [];
    }

    /**
     * Calculates the cumulative gravitational force vector pulling on an object.
     * Formula: F = G * (m1 * m2) / r^2
     * @param {THREE.Vector3} position - Position of the affected object
     * @param {number} [mass=1.0] - Mass of the affected object
     * @returns {THREE.Vector3} Cumulative gravity force acceleration vector
     */
    calculateForce(position, mass = 1.0) {
        const netForce = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < this.bodies.length; i++) {
            const body = this.bodies[i];
            
            // Get vector pointing from object to planet center
            const dir = new THREE.Vector3().copy(body.mesh.position).sub(position);
            const distSq = dir.lengthSq();
            const dist = Math.sqrt(distSq);

            // Avoid division by zero and clamp pull at close proximity
            if (dist < 1.0) continue;

            // Clamp minimum distance to prevent infinite forces near center
            const clampedDist = Math.max(dist, body.radius * 0.8);
            
            // Calculate force magnitude: F = G * (m1 * m2) / d^2
            const forceMagnitude = (this.G * body.mass * mass) / (clampedDist * clampedDist);
            
            // Normalize direction and scale by force
            dir.normalize().multiplyScalar(forceMagnitude);
            
            // Accumulate force
            netForce.add(dir);
        }

        return netForce;
    }
}
window.GravitySystem = GravitySystem;
