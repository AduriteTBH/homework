/**
 * H&H Invaders - Scene Manager
 * Responsible for Three.js initialization, rendering pipeline, viewport resize,
 * lighting configurations, and deep space background effects.
 */
class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container #${containerId} not found.`);
            return;
        }

        // Core Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Lighting
        this.ambientLight = null;
        this.directionalLight = null;
        this.spotLight = null;

        // Background elements
        this.starfield = null;
        this.nebulaPlanes = [];
        
        // Flight speed simulation variables
        this.warpSpeed = 1.0;
        this.flightDirection = new THREE.Vector3(0, 0, 1);

        // Run setup sequence
        this.initThree();
        this.initLights();
        this.initBackground();
        this.initResizeListener();
    }

    /**
     * Initializes Renderer, Scene, and Camera contexts.
     */
    initThree() {
        // Create Scene
        this.scene = new THREE.Scene();
        
        // Set fog for depth blending (dense black fog in space)
        this.scene.fog = new THREE.FogExp2(0x030508, 0.0015);

        // Perspective Camera: FOV 65, aspect, near 0.1, far 2000
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 2000);
        // Position camera slightly offset (will be updated by Player script)
        this.camera.position.set(0, 0, 0);

        // WebGL Renderer with antialias and alpha support
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
        this.renderer.setClearColor(0x030508, 1);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Add canvas to index.html container
        this.container.appendChild(this.renderer.domElement);
    }

    /**
     * Initializes lighting for stylized sci-fi realism.
     */
    initLights() {
        // Subtle ambient filling light (colored blue/purple space glow)
        this.ambientLight = new THREE.AmbientLight(0x0f172a, 1.2);
        this.scene.add(this.ambientLight);

        // Strong key light (resembles light from a local stellar body/star)
        this.directionalLight = new THREE.DirectionalLight(0xffaa44, 2.0);
        this.directionalLight.position.set(100, 50, -100);
        this.scene.add(this.directionalLight);

        // Cyan accent light shining slightly from the cockpit region
        this.spotLight = new THREE.SpotLight(0x00f3ff, 3, 50, Math.PI / 3, 0.5, 1);
        this.spotLight.position.set(0, 0, 5);
        this.scene.add(this.spotLight);
    }

    /**
     * Generates starfield particles and glowing canvas-textured nebulae.
     */
    initBackground() {
        // 1. Starfield Generation
        const starCount = 3500;
        const starGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        const colorPalette = [
            new THREE.Color(0xffffff), // Pure white
            new THREE.Color(0x00f3ff), // Cyan star
            new THREE.Color(0xff0055), // Magenta star
            new THREE.Color(0x8b5cf6), // Purple star
            new THREE.Color(0xfcbd10)  // Golden star
        ];

        for (let i = 0; i < starCount; i++) {
            // Distribute stars spherically around origin
            const radius = 600 + Math.random() * 400;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            // Assign color
            const randColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i * 3] = randColor.r;
            colors[i * 3 + 1] = randColor.g;
            colors[i * 3 + 2] = randColor.b;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // Point Material with size attenuation enabled
        const starMaterial = new THREE.PointsMaterial({
            size: 1.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        this.starfield = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starfield);

        // 2. Procedural Canvas Nebulae
        // We render circular color radial gradients into dynamic canvas elements and map them as textures
        const createNebulaTexture = (colorHex, alpha) => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createRadialGradient(256, 256, 10, 256, 256, 240);
            gradient.addColorStop(0, colorHex + alpha);
            gradient.addColorStop(0.3, colorHex + '1a'); // fade
            gradient.addColorStop(0.7, colorHex + '05'); // soft fade
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 512);
            
            return new THREE.CanvasTexture(canvas);
        };

        const nebulaColors = ['#ff0055', '#00f3ff', '#8b5cf6'];
        
        // Position three massive nebula gas clouds far behind the play space
        for (let i = 0; i < 3; i++) {
            const size = 600 + Math.random() * 400;
            const geom = new THREE.PlaneGeometry(size, size);
            
            const texture = createNebulaTexture(nebulaColors[i], '33'); // alpha 0.2 approx
            const mat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            });

            const mesh = new THREE.Mesh(geom, mat);
            // Place far back, randomized positions
            mesh.position.set(
                (Math.random() - 0.5) * 500,
                (Math.random() - 0.5) * 300,
                -700 - Math.random() * 200
            );
            mesh.rotation.z = Math.random() * Math.PI * 2;
            
            this.scene.add(mesh);
            this.nebulaPlanes.push(mesh);
        }
    }

    /**
     * Listens for browser window resize events.
     */
    initResizeListener() {
        window.addEventListener('resize', () => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();

            this.renderer.setSize(width, height);
        });
    }

    /**
     * Updates background elements to simulate active spaceflight.
     * @param {number} deltaTime - Time elapsed since last frame.
     * @param {THREE.Vector3} movementOffset - Slight vector to shift stars opposite to pilot movement.
     */
    update(deltaTime, movementOffset) {
        // Rotate starfield slowly to represent passive orbital motion
        if (this.starfield) {
            this.starfield.rotation.y += 0.005 * deltaTime;
            this.starfield.rotation.z += 0.002 * deltaTime;
            
            // Shift starfield slightly opposite to player movement to increase depth
            this.starfield.position.x = -movementOffset.x * 5;
            this.starfield.position.y = -movementOffset.y * 5;
        }

        // Slowly drift nebula clouds
        this.nebulaPlanes.forEach((plane, index) => {
            plane.rotation.z += 0.01 * (index + 1) * deltaTime;
            plane.position.x += Math.sin(Date.now() * 0.0001 * (index + 1)) * 0.02;
        });
    }

    /**
     * Triggers WebGL rendering cycle.
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
window.SceneManager = SceneManager;
