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
        this.atmospheres = [];  // Atmospheric glow meshes
        
        this.initPlanets();
    }

    /**
     * Initializes and positions all planets in the background.
     */
    initPlanets() {
        // Randomize sizes and colors for a unique layout every launch
        // Helper to force planets to spawn strictly on the far left or far right, leaving the center clear
        const sideSpawnX = () => {
            const side = Math.random() < 0.5 ? -1 : 1;
            return side * (250 + Math.random() * 300); // Spawns between 250 to 550 on either side
        };
        const rPosY = () => (Math.random() - 0.5) * 200;

        // Push them WAY back so they don't block the flight path
        const zDist1 = -800 - Math.random() * 400;
        const zDist2 = -1200 - Math.random() * 600;
        
        // Random Hues
        const earthHueBase = Math.random() * 360;
        const giantHueBase = Math.random() * 360;

        // 1. Earth-like Planet
        const earthRadius = 80 + Math.random() * 60; // Much larger to compensate for distance
        const earthGeom = new THREE.SphereGeometry(earthRadius, 64, 64);
        
        // Generate detailed planet with randomized hues
        const earthTextures = this.generateDetailedEarthTexture(earthHueBase);
        const earthMat = new THREE.MeshBasicMaterial({ map: earthTextures.map });
        
        const earthMesh = new THREE.Mesh(earthGeom, earthMat);
        earthMesh.position.set(sideSpawnX(), rPosY(), zDist1);
        earthMesh.rotation.set(Math.random(), Math.random(), Math.random());
        
        // Lethal winds property
        earthMesh.userData.isLethalPlanet = true;
        earthMesh.userData.baseRadius = earthRadius;
        earthMesh.userData.deathRadius = earthRadius * 1.1; // 10% above surface is deadly
        
        this.scene.add(earthMesh);
        this.planets.push(earthMesh);

        // Bind Earth to gravity system (Strong pull)
        this.gravitySystem.addBody(earthMesh, earthRadius * 6, earthRadius);

        // Create an outer atmospheric cloud layer sphere
        const cloudGeom = new THREE.SphereGeometry(earthRadius * 1.02, 64, 64);
        const cloudTexture = this.generateCloudTexture();
        const cloudMat = new THREE.MeshBasicMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.35,
            depthWrite: false
        });
        this.cloudsMesh = new THREE.Mesh(cloudGeom, cloudMat);
        this.cloudsMesh.position.copy(earthMesh.position);
        this.scene.add(this.cloudsMesh);

        // Create Atmospheric Glow Halo
        const earthAtmosphereGeom = new THREE.SphereGeometry(earthRadius * 1.12, 32, 32);
        const earthAtmosphereMat = this.createAtmosphereMaterial(new THREE.Color().setHSL(earthHueBase/360, 0.8, 0.5));
        const earthAtmosphere = new THREE.Mesh(earthAtmosphereGeom, earthAtmosphereMat);
        earthAtmosphere.position.copy(earthMesh.position);
        this.scene.add(earthAtmosphere);
        this.atmospheres.push(earthAtmosphere);

        // 2. Gas Giant
        const giantRadius = 120 + Math.random() * 80;
        const giantGeom = new THREE.SphereGeometry(giantRadius, 64, 64);
        const giantTexture = this.generateDetailedGasGiantTexture(giantHueBase);
        const giantMat = new THREE.MeshBasicMaterial({ map: giantTexture });

        const giantMesh = new THREE.Mesh(giantGeom, giantMat);
        // Ensure Gas Giant is also strictly on the side
        giantMesh.position.set(sideSpawnX(), rPosY(), zDist2);
        giantMesh.rotation.set(Math.random(), Math.random(), Math.random());
        
        // Lethal winds property
        giantMesh.userData.isLethalPlanet = true;
        giantMesh.userData.baseRadius = giantRadius;
        giantMesh.userData.deathRadius = giantRadius * 1.1;
        
        this.scene.add(giantMesh);
        this.planets.push(giantMesh);

        // Bind Gas Giant to gravity system
        this.gravitySystem.addBody(giantMesh, giantRadius * 6, giantRadius);

        // Create Gas Giant Atmospheric Glow Halo
        const giantAtmosphereGeom = new THREE.SphereGeometry(giantRadius * 1.12, 32, 32);
        const giantAtmosphereMat = this.createAtmosphereMaterial(new THREE.Color().setHSL(giantHueBase/360, 0.9, 0.5));
        const giantAtmosphere = new THREE.Mesh(giantAtmosphereGeom, giantAtmosphereMat);
        giantAtmosphere.position.copy(giantMesh.position);
        this.scene.add(giantAtmosphere);
        this.atmospheres.push(giantAtmosphere);

        // Randomly add a ring to the giant
        if (Math.random() > 0.3) {
            const innerRingRadius = giantRadius * (1.2 + Math.random() * 0.4);
            const outerRingRadius = giantRadius * (2.0 + Math.random() * 0.8);
            const ringGeom = new THREE.RingGeometry(innerRingRadius, outerRingRadius, 64);
            
            const ringTexture = this.generateRingTexture(giantHueBase);
            const ringMat = new THREE.MeshBasicMaterial({
                map: ringTexture,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide,
                depthWrite: false
            });

            const ringMesh = new THREE.Mesh(ringGeom, ringMat);
            ringMesh.rotation.x = Math.PI / 2 + (Math.random() - 0.5);
            ringMesh.rotation.y = (Math.random() - 0.5);
            giantMesh.add(ringMesh);
        }
    }

    /**
     * Helper to build a beautiful custom Fresnel rim atmospheric glow shader.
     */
    createAtmosphereMaterial(color) {
        return new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                uniform vec3 glowColor;
                void main() {
                    // Fresnel glow calculation based on camera facing angle
                    float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.5);
                    gl_FragColor = vec4(glowColor, 1.0) * intensity;
                }
            `,
            uniforms: {
                glowColor: { value: color }
            },
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
    }

    /**
     * Generates a detailed stylized Earth texture with random base hue.
     */
    generateDetailedEarthTexture(hueBase = 220) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Emissive map for glowing cities on dark sides
        const eCanvas = document.createElement('canvas');
        eCanvas.width = 1024;
        eCanvas.height = 512;
        const eCtx = eCanvas.getContext('2d');
        eCtx.fillStyle = '#000000';
        eCtx.fillRect(0, 0, 1024, 512);

        // Fill ocean with random hue
        ctx.fillStyle = `hsl(${hueBase}, 60%, 15%)`;
        ctx.fillRect(0, 0, 1024, 512);

        // Shallow water details near land
        ctx.fillStyle = `hsl(${hueBase}, 65%, 25%)`;

        const landCoordinates = [];

        // Draw detailed green/brown land masses
        for (let i = 0; i < 20; i++) {
            const cx = Math.random() * 1024;
            const cy = 100 + Math.random() * 312; // Avoid absolute poles for continents
            const rx = 120 + Math.random() * 180;
            const ry = 90 + Math.random() * 120;

            landCoordinates.push({ cx, cy, rx, ry });

            // Coastal shallow shelf (Analogous hue)
            ctx.fillStyle = `hsl(${hueBase + 15}, 75%, 35%)`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx * 1.15, ry * 1.15, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();

            // Main landmass (Complementary or Triadic hue for contrast)
            ctx.fillStyle = `hsl(${(hueBase + 120) % 360}, 50%, 40%)`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
            ctx.fill();

            // Mountain / Desert details
            ctx.fillStyle = `hsl(${(hueBase + 90) % 360}, 60%, 50%)`;
            ctx.beginPath();
            ctx.ellipse(cx + (Math.random() - 0.5) * 50, cy + (Math.random() - 0.5) * 40, rx * 0.5, ry * 0.5, Math.random(), 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw polar ice caps at the top and bottom
        ctx.fillStyle = '#f8fafc'; // Crisp white ice
        ctx.beginPath();
        ctx.ellipse(512, 0, 512, 80, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(512, 512, 512, 80, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw glowing city light clusters on landmass locations (yellow emissive spots)
        eCtx.fillStyle = '#fbbf24'; // Warm golden city lights
        landCoordinates.forEach(land => {
            // Place clusters of dots in the landmass area
            for (let j = 0; j < 12; j++) {
                const lx = land.cx + (Math.random() - 0.5) * land.rx * 0.8;
                const ly = land.cy + (Math.random() - 0.5) * land.ry * 0.8;
                const citySize = 1.5 + Math.random() * 3.5;
                
                // Don't draw cities on polar ice caps
                if (ly > 85 && ly < 427) {
                    eCtx.beginPath();
                    eCtx.arc(lx, ly, citySize, 0, Math.PI * 2);
                    eCtx.fill();

                    // Soft light glow around core city center
                    eCtx.fillStyle = 'rgba(251, 191, 36, 0.4)';
                    eCtx.beginPath();
                    eCtx.arc(lx, ly, citySize * 2.5, 0, Math.PI * 2);
                    eCtx.fill();
                    eCtx.fillStyle = '#fbbf24';
                }
            }
        });

        return {
            map: new THREE.CanvasTexture(canvas),
            emissiveMap: new THREE.CanvasTexture(eCanvas)
        };
    }

    /**
     * Generates a heavily banded, stormy gas giant texture with randomized hues.
     */
    generateDetailedGasGiantTexture(hueBase = 280) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base color
        ctx.fillStyle = `hsl(${hueBase}, 50%, 20%)`;
        ctx.fillRect(0, 0, 1024, 512);

        // Draw multiple horizontal turbulent bands
        for (let i = 0; i < 40; i++) {
            const y = Math.random() * 512;
            const h = 5 + Math.random() * 45;
            const hue = hueBase + (Math.random() - 0.5) * 60; // Vary color slightly around base
            
            // Bands can be darker or lighter
            const lightness = 15 + Math.random() * 40;
            ctx.fillStyle = `hsl(${hue}, 60%, ${lightness}%)`;
            ctx.fillRect(0, y, 1024, h);
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'; // Fluffy white clouds

        for (let i = 0; i < 35; i++) {
            const cx = Math.random() * 1024;
            const cy = Math.random() * 512;
            const size = 50 + Math.random() * 90;

            // Draw long streaky swirling clouds
            ctx.beginPath();
            ctx.ellipse(cx, cy, size * 3.2, size * 0.35, (Math.random() - 0.5) * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }

        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Generates pink/magenta gas giant texture with detailed organic swirling bands.
     */
    generateDetailedGasGiantTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const bands = [
            '#2e0854', // Dark deep purple
            '#581c87', // Rich violet
            '#a21caf', // Saturated magenta
            '#ec4899', // Hot pink
            '#a21caf',
            '#581c87',
            '#2e0854'
        ];

        // Draw horizontal band stripes with wavy distortion patterns
        const bandHeight = 512 / bands.length;
        for (let i = 0; i < bands.length; i++) {
            ctx.fillStyle = bands[i];
            ctx.fillRect(0, i * bandHeight, 1024, bandHeight);
            
            // Layer organic blending gradients
            const grad = ctx.createLinearGradient(0, i * bandHeight, 0, (i + 1) * bandHeight);
            grad.addColorStop(0, 'rgba(0,0,0,0.2)');
            grad.addColorStop(0.5, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.2)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, i * bandHeight, 1024, bandHeight);
        }

        // Draw wavy/swirling interfaces between bands
        for (let y = 1; y < bands.length; y++) {
            const boundaryY = y * bandHeight;
            ctx.fillStyle = bands[y];
            ctx.beginPath();
            ctx.moveTo(0, boundaryY);
            for (let x = 0; x <= 1024; x += 16) {
                const swirlOffset = Math.sin(x * 0.03 + y) * 15 + Math.cos(x * 0.01) * 8;
                ctx.lineTo(x, boundaryY + swirlOffset);
            }
            ctx.lineTo(1024, 512);
            ctx.lineTo(0, 512);
            ctx.fill();
        }

        // Draw giant red/orange storm oval (Great Red Spot analogue) with rings
        ctx.fillStyle = '#f97316'; // Neon orange outer
        ctx.beginPath();
        ctx.ellipse(650, 320, 75, 40, 0.05, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f43f5e'; // Deep rose center
        ctx.beginPath();
        ctx.ellipse(650, 320, 45, 22, 0.05, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff'; // White core highlight
        ctx.beginPath();
        ctx.ellipse(640, 315, 12, 6, 0.05, 0, Math.PI * 2);
        ctx.fill();

        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Generates a circular concentric rings transparency map.
     */
    generateRingTexture(hueBase = 300) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256; // Use higher resolution for smooth rings
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, 1024, 256);

        // Draw concentric ring lanes horizontally across the canvas height
        for (let y = 0; y < 256; y += 1) {
            // Add gaps between rings
            if (Math.random() > 0.6) continue;

            const thickness = 1 + Math.floor(Math.random() * 4);
            const alpha = 0.2 + Math.random() * 0.75;
            
            // Use random hue around the planet's base hue, plus occasional white dust lanes
            let fillStyle = `hsla(${hueBase + (Math.random()-0.5)*40}, 80%, 60%, ${alpha})`;
            if (Math.random() < 0.25) fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`; // White Dust Lane
            
            ctx.fillStyle = fillStyle;
            ctx.fillRect(0, y, 1024, thickness); // Horizontal bars!
            y += thickness;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    /**
     * Updates planetary orbital rotations in the background and slowly moves them past the camera
     * to simulate deep space travel. Recycles them when out of view.
     * @param {number} deltaTime - Time elapsed since last frame
     */
    update(deltaTime) {
        // Significantly increased passing speed so planets actually reach the player and force dodging
        const passingSpeed = 65.0; 

        this.planets.forEach((planet, index) => {
            // 1. Move planets past camera
            planet.position.z += passingSpeed * deltaTime;
            
            // 2. Recycle planets that pass far behind the camera (Infinite Planets)
            if (planet.position.z > 200) {
                // Throw it far into the background
                planet.position.z = -1200 - Math.random() * 800;
                
                // Randomize lateral position to push strictly to the left or right!
                const side = Math.random() < 0.5 ? -1 : 1;
                planet.position.x = side * (250 + Math.random() * 300);
                planet.position.y = (Math.random() - 0.5) * 100;

                // Randomize scale massively to give variance
                const scale = 0.5 + Math.random() * 1.5;
                planet.scale.set(scale, scale, scale);

                // FIXED: Update death radius based on new scaled size
                if (planet.userData.baseRadius) {
                    planet.userData.deathRadius = planet.userData.baseRadius * scale * 1.1;
                }

                // FIXED: Update the gravity system so the physics pull matches the new visual size
                const gBody = this.gravitySystem.bodies.find(b => b.mesh === planet);
                if (gBody && planet.userData.baseRadius) {
                    gBody.radius = planet.userData.baseRadius * scale;
                    gBody.mass = gBody.radius * 6;
                }

                // Randomize rotation
                planet.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

                // For the material, let's randomize color tints to make them look like new exo-planets!
                if (planet.material) {
                    const r = 0.2 + Math.random() * 0.8;
                    const g = 0.2 + Math.random() * 0.8;
                    const b = 0.2 + Math.random() * 0.8;
                    planet.material.color.setRGB(r, g, b);
                    if (planet.material.emissive) {
                        planet.material.emissive.setRGB(r*0.5, g*0.5, b*0.5);
                    }
                }
            }
        });

        // Rotate Earth
        if (this.planets[0]) {
            this.planets[0].rotation.y += 0.012 * deltaTime;
        }
        
        // Update Earth clouds
        if (this.cloudsMesh && this.planets[0]) {
            this.cloudsMesh.position.copy(this.planets[0].position);
            this.cloudsMesh.scale.copy(this.planets[0].scale);
            this.cloudsMesh.rotation.y -= 0.02 * deltaTime;
            this.cloudsMesh.rotation.x += 0.003 * deltaTime;
            if (this.cloudsMesh.material) {
                this.cloudsMesh.material.color.copy(this.planets[0].material.color);
            }
        }

        // Rotate Gas Giant
        if (this.planets[1]) {
            this.planets[1].rotation.y += 0.008 * deltaTime;
        }

        // Align atmospheres
        this.atmospheres.forEach((atmosphere, index) => {
            if (this.planets[index]) {
                atmosphere.position.copy(this.planets[index].position);
                atmosphere.scale.copy(this.planets[index].scale);
                if (atmosphere.material && atmosphere.material.uniforms && atmosphere.material.uniforms.glowColor) {
                    const planetColor = this.planets[index].material.color;
                    atmosphere.material.uniforms.glowColor.value.copy(planetColor);
                }
            }
        });
    }
}
window.EnvironmentManager = EnvironmentManager;

