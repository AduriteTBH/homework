/**
 * H&H Invaders - Planets Manager
 * Generates stylized, highly saturated 3D celestial bodies (Earth-like and Ringed planets)
 * using procedural textures drawn via HTML5 canvas, and registers them in the GravitySystem.
 */
class EnvironmentManager {
    constructor(scene, gravitySystem) {
        this.scene = scene;
        this.gravitySystem = gravitySystem;
        
        // Planet reference arrays
        this.planets = [];
        this.cloudsMesh = null; // Reference to rotate the atmosphere separately
        
        this.initPlanets();
    }

    /**
     * Initializes and positions all planets in the background.
     */
    initPlanets() {
        // 1. Earth-like Planet (Left Side)
        const earthRadius = 35;
        const earthGeom = new THREE.SphereGeometry(earthRadius, 32, 32);
        
        // Generate a stylized blue, green, and brown continental canvas texture
        const earthTexture = this.generateEarthTexture();
        const earthMat = new THREE.MeshStandardMaterial({
            map: earthTexture,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true // Low-to-medium poly faceted look
        });
        
        const earthMesh = new THREE.Mesh(earthGeom, earthMat);
        earthMesh.position.set(-80, -20, -280);
        earthMesh.rotation.set(0.4, 0.2, 0.1);
        this.scene.add(earthMesh);
        this.planets.push(earthMesh);

        // Bind Earth to gravity system (Mass: 180)
        this.gravitySystem.addBody(earthMesh, 180, earthRadius);

        // Create an outer atmospheric cloud layer sphere (slightly larger)
        const cloudGeom = new THREE.SphereGeometry(earthRadius + 0.6, 32, 32);
        const cloudTexture = this.generateCloudTexture();
        const cloudMat = new THREE.MeshStandardMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.45,
            blending: THREE.NormalBlending,
            depthWrite: false
        });
        this.cloudsMesh = new THREE.Mesh(cloudGeom, cloudMat);
        this.cloudsMesh.position.copy(earthMesh.position);
        this.scene.add(this.cloudsMesh);

        // 2. Ringed Purple Gas Giant (Right Side)
        const giantRadius = 25;
        const giantGeom = new THREE.SphereGeometry(giantRadius, 32, 32);
        const giantTexture = this.generateGasGiantTexture();
        const giantMat = new THREE.MeshStandardMaterial({
            map: giantTexture,
            roughness: 0.6,
            metalness: 0.2,
            flatShading: true
        });

        const giantMesh = new THREE.Mesh(giantGeom, giantMat);
        giantMesh.position.set(90, 25, -320);
        giantMesh.rotation.set(-0.3, -0.5, 0.2);
        this.scene.add(giantMesh);
        this.planets.push(giantMesh);

        // Bind Gas Giant to gravity system (Mass: 140)
        this.gravitySystem.addBody(giantMesh, 140, giantRadius);

        // Build Planetary Ring
        const innerRingRadius = giantRadius * 1.4;
        const outerRingRadius = giantRadius * 2.3;
        const ringGeom = new THREE.RingGeometry(innerRingRadius, outerRingRadius, 64);
        
        // Custom texture with concentric rings
        const ringTexture = this.generateRingTexture();
        const ringMat = new THREE.MeshBasicMaterial({
            map: ringTexture,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        // Tilt ring relative to the planet
        ringMesh.rotation.x = Math.PI / 2.3;
        ringMesh.rotation.y = Math.PI / 8;
        
        // Make the ring a child of the planet so it aligns and rotates in sync
        giantMesh.add(ringMesh);
    }

    /**
     * Generates a stylized Earth texture (Blue oceans, green/brown land chunks).
     */
    generateEarthTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Fill ocean blue
        ctx.fillStyle = '#1e40af'; // Saturated deep blue
        ctx.fillRect(0, 0, 1024, 512);

        // Draw green/brown land masses
        ctx.fillStyle = '#15803d'; // Forest green
        for (let i = 0; i < 15; i++) {
            const cx = Math.random() * 1024;
            const cy = Math.random() * 512;
            const rx = 100 + Math.random() * 150;
            const ry = 80 + Math.random() * 100;

            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();

            // Splotch details (sandy coast / desert)
            ctx.fillStyle = '#b45309'; // Desert brown
            ctx.beginPath();
            ctx.ellipse(cx + (Math.random() - 0.5) * 50, cy + (Math.random() - 0.5) * 40, rx * 0.6, ry * 0.6, Math.random(), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#15803d'; // Reset color
        }

        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Generates a transparent white cloud texture map.
     */
    generateCloudTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 1024, 512);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // Fluffy white clouds

        for (let i = 0; i < 20; i++) {
            const cx = Math.random() * 1024;
            const cy = Math.random() * 512;
            const size = 60 + Math.random() * 80;

            // Draw long streaky clouds
            ctx.beginPath();
            ctx.ellipse(cx, cy, size * 2.5, size * 0.4, Math.random() * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Generates pink/magenta gas giant texture with horizontal bands.
     */
    generateGasGiantTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const bands = [
            '#4a044e', // Deep magenta
            '#701a75',
            '#a21caf', // Saturated purple
            '#d946ef', // Bright violet
            '#701a75',
            '#4a044e'
        ];

        // Draw horizontal band stripes
        const bandHeight = 256 / bands.length;
        for (let i = 0; i < bands.length; i++) {
            ctx.fillStyle = bands[i];
            ctx.fillRect(0, i * bandHeight, 512, bandHeight);
            
            // Add soft gradients at borders
            const grad = ctx.createLinearGradient(0, i * bandHeight, 0, (i + 1) * bandHeight);
            grad.addColorStop(0, 'rgba(0,0,0,0.15)');
            grad.addColorStop(0.5, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.15)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, i * bandHeight, 512, bandHeight);
        }

        // Draw giant red/orange storm oval
        ctx.fillStyle = '#f97316'; // Neon orange
        ctx.beginPath();
        ctx.ellipse(280, 160, 45, 22, 0.05, 0, Math.PI * 2);
        ctx.fill();

        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Generates a circular concentric rings transparency map.
     */
    generateRingTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 16; // Horizontal strip representing rings outwards
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 512, 16);

        // Draw random translucent bars representing planetary ring lanes
        for (let x = 0; x < 512; x += 3) {
            const width = 2 + Math.floor(Math.random() * 8);
            const alpha = 0.15 + Math.random() * 0.65;
            
            // Hue shifts between cyan, purple, and white
            let fillStyle = `rgba(217, 70, 239, ${alpha})`; // Purple default
            if (Math.random() < 0.3) fillStyle = `rgba(0, 243, 255, ${alpha * 0.8})`; // Cyan lane
            else if (Math.random() < 0.25) fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`; // Bright white dust lane
            
            ctx.fillStyle = fillStyle;
            ctx.fillRect(x, 0, width, 16);
            x += width;
        }

        const texture = new THREE.CanvasTexture(canvas);
        // Map texture coordinates as concentric circles (default RingGeometry uvs align horizontally)
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    /**
     * Updates planetary orbital rotations in the background.
     * @param {number} deltaTime - Time elapsed since last frame
     */
    update(deltaTime) {
        // Rotate Earth
        if (this.planets[0]) {
            this.planets[0].rotation.y += 0.012 * deltaTime;
        }
        // Rotate Earth clouds slightly faster in opposite direction
        if (this.cloudsMesh) {
            this.cloudsMesh.rotation.y -= 0.02 * deltaTime;
            this.cloudsMesh.rotation.x += 0.003 * deltaTime;
        }

        // Rotate Gas Giant
        if (this.planets[1]) {
            this.planets[1].rotation.y += 0.008 * deltaTime;
        }
    }
}
window.EnvironmentManager = EnvironmentManager;
