/**
 * H&H Invaders - Interior Walking Manager
 * Handles the walk-around spaceship phase.
 * Manages procedural cabin rendering, Pointer Lock controls, and cockpit seat transition triggers.
 * Character controls are delegated to InteriorPlayer (character.js).
 */
class InteriorManager {
    constructor(scene, camera, audioSystem) {
        this.scene = scene;
        this.camera = camera;
        this.audioSystem = audioSystem;

        this.active = false;
        
        // Walking group container
        this.interiorGroup = new THREE.Group();
        this.scene.add(this.interiorGroup);

        // Bounding boxes for walk boundaries (expanded for alcoves and up to front windshield at -35.5)
        this.bounds = {
            minX: -6.5, maxX: 6.5,
            minZ: -35.0, maxZ: 22,
            minY: 0, maxY: 3.5
        };

        // Pointer Lock State
        this.isLocked = false;
        this.mouseSensitivityMultiplier = 1.0;
        
        // Pilot Seat location
        this.seatPosition = new THREE.Vector3(0, 0.8, -32);
        this.promptActive = false;

        // Instantiate character controller inside the walking group
        this.player = new window.InteriorPlayer(this.interiorGroup, this.camera, this.bounds, this.seatPosition, this.audioSystem);

        this.initInteriorScene();
        this.bindPointerLock();
    }

    // Proxy getters/setters to ensure backwards compatibility with main.js
    get characterMesh() { return this.player.characterMesh; }
    set characterMesh(val) { this.player.characterMesh = val; }

    get playerPosition() { return this.player.position; }
    set playerPosition(val) { this.player.position = val; }

    get playerVelocity() { return this.player.velocity; }
    set playerVelocity(val) { this.player.velocity = val; }

    get playerYaw() { return this.player.yaw; }
    set playerYaw(val) { this.player.yaw = val; }

    get playerPitch() { return this.player.pitch; }
    set playerPitch(val) { this.player.pitch = val; }

    get isJumping() { return this.player.isJumping; }
    set isJumping(val) { this.player.isJumping = val; }
    initInteriorScene() {
        // Generate highly optimized procedural textures
        const floorTex = this.generateFloorTexture();
        const wallTex = this.generateWallTexture();
        const crateTex = this.generateCrateTexture();

        // MeshPhongMaterial: per-PIXEL lighting (not per-vertex like Lambert).
        // Handles point lights correctly on large flat surfaces like corridor walls.
        // Much cheaper than MeshStandardMaterial (no PBR), but looks the same under colored lights.
        // Brightened base colors so the scene isn't too dim.
        const metalMat = new THREE.MeshPhongMaterial({ map: wallTex, color: 0x2a2a35, shininess: 30 });
        const metalTrimMat = new THREE.MeshPhongMaterial({ map: wallTex, color: 0x3a3a4a, shininess: 70 });
        const floorMat = new THREE.MeshPhongMaterial({ map: floorTex, color: 0x1a1a22, shininess: 20 });
        const crateMat = new THREE.MeshPhongMaterial({ map: crateTex, color: 0x666666, shininess: 15 });
        const copperMat = new THREE.MeshPhongMaterial({ color: 0xb45309, shininess: 80 });
        const steelPipeMat = new THREE.MeshPhongMaterial({ color: 0x71717a, shininess: 100 });
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff }); // Stays Basic (emissive)
        const orangeLightMat = new THREE.MeshBasicMaterial({ color: 0xf97316 }); // Stays Basic (emissive)
        const glassMat = new THREE.MeshPhongMaterial({
            color: 0x0ea5e9, transparent: true, opacity: 0.25, shininess: 120
        });

        // 1. Segmented Floor Panels to prevent Z-fighting and avoid clipping empty space at the cockpit
        const floorGeomMain = new THREE.BoxGeometry(8, 0.1, 65.5);
        const floorMeshMain = new THREE.Mesh(floorGeomMain, floorMat);
        floorMeshMain.position.set(0, -0.05, -2.75);
        this.interiorGroup.add(floorMeshMain);

        const floorGeomLeft = new THREE.BoxGeometry(2.5, 0.1, 8);
        const floorMeshLeft = new THREE.Mesh(floorGeomLeft, floorMat);
        floorMeshLeft.position.set(-5.25, -0.05, 2.0);
        this.interiorGroup.add(floorMeshLeft);

        const floorGeomRight = new THREE.BoxGeometry(2.5, 0.1, 8);
        const floorMeshRight = new THREE.Mesh(floorGeomRight, floorMat);
        floorMeshRight.position.set(5.25, -0.05, -12.0);
        this.interiorGroup.add(floorMeshRight);

        // === FAKE LIGHT SOURCES (Zero FPS cost, huge visual impact) ===
        // Glowing neon trim lines matching the modular wall segments
        const orangeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        
        const createTrim = (mat, x, y, z, length) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, length), mat);
            mesh.position.set(x, y, z);
            this.interiorGroup.add(mesh);
        };

        // Left wall trims (x = -3.9)
        // Segment 1: center z = -18.75, length = 33.5 (ends at windshield)
        createTrim(cyanGlowMat, -3.9, 3.4, -18.75, 33.5);
        createTrim(orangeGlowMat, -3.9, 1.2, -18.75, 33.5);
        // Segment 2: center z = 15.5, length = 19
        createTrim(cyanGlowMat, -3.9, 3.4, 15.5, 19);
        createTrim(orangeGlowMat, -3.9, 1.2, 15.5, 19);

        // Right wall trims (x = 3.9)
        // Segment 1: center z = -25.75, length = 19.5 (ends at windshield)
        createTrim(cyanGlowMat, 3.9, 3.4, -25.75, 19.5);
        createTrim(orangeGlowMat, 3.9, 1.2, -25.75, 19.5);
        // Segment 2: center z = 8.5, length = 33
        createTrim(cyanGlowMat, 3.9, 3.4, 8.5, 33);
        createTrim(orangeGlowMat, 3.9, 1.2, 8.5, 33);

        // 2. Segmented Ceiling Panels
        const ceilingGeomMain = new THREE.BoxGeometry(8, 0.1, 65.5);
        const ceilingMeshMain = new THREE.Mesh(ceilingGeomMain, metalMat);
        ceilingMeshMain.position.set(0, 3.5, -2.75);
        this.interiorGroup.add(ceilingMeshMain);

        const ceilingGeomLeft = new THREE.BoxGeometry(2.5, 0.1, 8);
        const ceilingMeshLeft = new THREE.Mesh(ceilingGeomLeft, metalMat);
        ceilingMeshLeft.position.set(-5.25, 3.5, 2.0);
        this.interiorGroup.add(ceilingMeshLeft);

        const ceilingGeomRight = new THREE.BoxGeometry(2.5, 0.1, 8);
        const ceilingMeshRight = new THREE.Mesh(ceilingGeomRight, metalMat);
        ceilingMeshRight.position.set(5.25, 3.5, -12.0);
        this.interiorGroup.add(ceilingMeshRight);

        // 3. Walls (Overhauled with side alcoves)
        const wallHeight = 3.5;
        const wallThickness = 0.2;
        
        // Left Wall Segment 1 (z = -35.5 to z = -2)
        const leftWall1 = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, 33.5), metalMat);
        leftWall1.position.set(-4, wallHeight / 2, -18.75);
        this.interiorGroup.add(leftWall1);

        // Left Wall Segment 2 (z = 6 to z = 25)
        const leftWall2 = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, 19), metalMat);
        leftWall2.position.set(-4, wallHeight / 2, 15.5);
        this.interiorGroup.add(leftWall2);

        // Engineering Alcove outer boundaries (pushed to x = -6.5, z = -2 to 6)
        const leftAlcoveBack = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, 8), metalMat);
        leftAlcoveBack.position.set(-6.5, wallHeight / 2, 2);
        this.interiorGroup.add(leftAlcoveBack);

        const leftAlcoveSide1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, wallHeight, wallThickness), metalMat);
        leftAlcoveSide1.position.set(-5.25, wallHeight / 2, -2);
        this.interiorGroup.add(leftAlcoveSide1);

        const leftAlcoveSide2 = new THREE.Mesh(new THREE.BoxGeometry(2.5, wallHeight, wallThickness), metalMat);
        leftAlcoveSide2.position.set(-5.25, wallHeight / 2, 6);
        this.interiorGroup.add(leftAlcoveSide2);


        // Right Wall Segment 1 (z = -35.5 to z = -16)
        const rightWall1 = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, 19.5), metalMat);
        rightWall1.position.set(4, wallHeight / 2, -25.75);
        this.interiorGroup.add(rightWall1);

        // Right Wall Segment 2 (z = -8 to z = 25)
        const rightWall2 = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, 33), metalMat);
        rightWall2.position.set(4, wallHeight / 2, 8.5);
        this.interiorGroup.add(rightWall2);

        // Bunk Alcove outer boundaries (pushed to x = 6.5, z = -16 to -8)
        const rightAlcoveBack = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, 8), metalMat);
        rightAlcoveBack.position.set(6.5, wallHeight / 2, -12);
        this.interiorGroup.add(rightAlcoveBack);

        const rightAlcoveSide1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, wallHeight, wallThickness), metalMat);
        rightAlcoveSide1.position.set(5.25, wallHeight / 2, -16);
        this.interiorGroup.add(rightAlcoveSide1);

        const rightAlcoveSide2 = new THREE.Mesh(new THREE.BoxGeometry(2.5, wallHeight, wallThickness), metalMat);
        rightAlcoveSide2.position.set(5.25, wallHeight / 2, -8);
        this.interiorGroup.add(rightAlcoveSide2);

        // 4. Back wall and front windshield
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(8, wallHeight, wallThickness), metalMat);
        backWall.position.set(0, wallHeight / 2, 25);
        this.interiorGroup.add(backWall);

        const frontWindshield = new THREE.Mesh(new THREE.BoxGeometry(8, 2, wallThickness), glassMat);
        frontWindshield.position.set(0, 2.5, -35.5);
        this.interiorGroup.add(frontWindshield);

        const frontLowerWall = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, wallThickness), metalMat);
        frontLowerWall.position.set(0, 0.75, -35.5);
        this.interiorGroup.add(frontLowerWall);

        // 5. Spaceship structural bulkheads / wall ribs
        // Places vertical arches at intervals along the corridor, adapting to alcove widths
        for (let z = -31.5; z <= 22; z += 6.5) {
            const inLeftAlcove = (z >= -2.5 && z <= 6.5);
            const inRightAlcove = (z >= -16.5 && z <= -7.5);

            // Left Rib position
            const leftX = inLeftAlcove ? -6.35 : -3.85;
            const leftRib = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 0.4), metalTrimMat);
            leftRib.position.set(leftX, 1.75, z);
            this.interiorGroup.add(leftRib);

            // Right Rib position
            const rightX = inRightAlcove ? 6.35 : 3.85;
            const rightRib = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.5, 0.4), metalTrimMat);
            rightRib.position.set(rightX, 1.75, z);
            this.interiorGroup.add(rightRib);

            // Ceiling beam width to bridge between left and right rib
            const beamWidth = rightX - leftX;
            const ceilingBeam = new THREE.Mesh(new THREE.BoxGeometry(beamWidth, 0.25, 0.4), metalTrimMat);
            ceilingBeam.position.set((leftX + rightX) / 2, 3.35, z);
            this.interiorGroup.add(ceilingBeam);
        }

        // 6. Detailing the Side Alcoves

        // Engineering Reactor Core (Inside Left Alcove)
        const coreGeo = new THREE.CylinderGeometry(0.6, 0.6, 3.4, 16);
        const coreMat = new THREE.MeshPhongMaterial({ color: 0x18181b, shininess: 40 });
        const reactorCore = new THREE.Mesh(coreGeo, coreMat);
        reactorCore.position.set(-5.4, 1.7, 2.0);
        this.interiorGroup.add(reactorCore);

        // Glowing rings around reactor
        for (let i = 0; i < 4; i++) {
            const ringGeo = new THREE.TorusGeometry(0.68, 0.05, 8, 24);
            const ring = new THREE.Mesh(ringGeo, lightMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(-5.4, 0.5 + i * 0.8, 2.0);
            this.interiorGroup.add(ring);
        }

        // Double Bunk Bed Frame & Mattresses (Inside Right Alcove)
        const bunkFrameMat = new THREE.MeshPhongMaterial({ color: 0x1e293b, shininess: 30 });
        const mattressMat = new THREE.MeshPhongMaterial({ color: 0x475569, shininess: 5 });

        const bunkFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.0, 6.0), bunkFrameMat);
        bunkFrame.position.set(5.35, 1.0, -12.0);
        this.interiorGroup.add(bunkFrame);

        // Lower mattress
        const lowerMattress = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 5.8), mattressMat);
        lowerMattress.position.set(5.35, 0.4, -12.0);
        this.interiorGroup.add(lowerMattress);

        // Upper mattress
        const upperMattress = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 5.8), mattressMat);
        upperMattress.position.set(5.35, 1.4, -12.0);
        this.interiorGroup.add(upperMattress);

        // 8. Spawning modular cargo crates & terminal cabinets along the floor/walls
        // Crate 1 (Left wall, middle-back)
        const crateGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
        // Crate material is now handled in initInteriorScene via crateMat
        const crate1 = new THREE.Mesh(crateGeo, crateMat);
        crate1.position.set(-2.8, 0.5, 9.0);
        crate1.rotation.y = 0.2;
        this.interiorGroup.add(crate1);

        // Crate 2 stacked on top slightly askew
        const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crateMat);
        crate2.position.set(-2.7, 1.35, 9.2);
        crate2.rotation.y = -0.3;
        this.interiorGroup.add(crate2);

        // Crate 3 (Right wall, middle-front)
        const crate3 = new THREE.Mesh(crateGeo, crateMat);
        crate3.position.set(2.8, 0.5, -5.0);
        crate3.rotation.y = -0.15;
        this.interiorGroup.add(crate3);

        // Computer Station / Terminal Panel (Left wall, middle-front)
        const terminalGeo = new THREE.BoxGeometry(0.4, 1.8, 1.2);
        const terminalMesh = new THREE.Mesh(terminalGeo, metalTrimMat);
        terminalMesh.position.set(-3.6, 0.9, -19.0);
        this.interiorGroup.add(terminalMesh);

        // Glowing screens on terminal
        const screenGeoWide = new THREE.BoxGeometry(0.02, 0.4, 0.8);
        const screenMesh = new THREE.Mesh(screenGeoWide, orangeLightMat);
        screenMesh.position.set(-3.39, 1.2, -19.0);
        this.interiorGroup.add(screenMesh);

        // 9. Procedural Light strips on Ceiling
        for (let z = -35; z <= 20; z += 10) {
            const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(3, 0.02, 0.2), lightMat);
            lightStrip.position.set(0, 3.44, z);
            this.interiorGroup.add(lightStrip);
        }

        // 10. Sci-Fi Cockpit Chairs
        const createChair = (pos, rotationY = 0) => {
            const chairGroup = new THREE.Group();
            chairGroup.position.copy(pos);
            chairGroup.rotation.y = rotationY;

            // Materials
            const cushionMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 10 }); // Dark leather look
            const frameMat = new THREE.MeshPhongMaterial({ color: 0x444455, shininess: 40 }); // Metal frame
            const accentMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff }); // Cyan glowing accents

            // Pedestal base
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.4, 8), frameMat);
            base.position.set(0, -0.2, 0);
            chairGroup.add(base);

            // Seat Cushion
            const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 1.0), cushionMat);
            seat.position.set(0, 0.1, 0);
            chairGroup.add(seat);

            // Backrest (Angled back)
            const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.2), cushionMat);
            backrest.position.set(0, 0.7, 0.4);
            backrest.rotation.x = -0.15; // Lean back
            chairGroup.add(backrest);

            // Headrest
            const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.2), cushionMat);
            headrest.position.set(0, 1.4, 0.5);
            headrest.rotation.x = -0.15;
            chairGroup.add(headrest);

            // Armrests (Left & Right)
            const armGeo = new THREE.BoxGeometry(0.15, 0.4, 0.8);
            const leftArm = new THREE.Mesh(armGeo, frameMat);
            leftArm.position.set(-0.55, 0.4, 0.1);
            chairGroup.add(leftArm);

            const rightArm = new THREE.Mesh(armGeo, frameMat);
            rightArm.position.set(0.55, 0.4, 0.1);
            chairGroup.add(rightArm);

            // Glowing trim on armrests
            const glowGeo = new THREE.BoxGeometry(0.02, 0.05, 0.6);
            const leftGlow = new THREE.Mesh(glowGeo, accentMat);
            leftGlow.position.set(-0.63, 0.55, 0.1);
            chairGroup.add(leftGlow);

            const rightGlow = new THREE.Mesh(glowGeo, accentMat);
            rightGlow.position.set(0.63, 0.55, 0.1);
            chairGroup.add(rightGlow);

            this.interiorGroup.add(chairGroup);
        };

        // Pilot Seat
        createChair(this.seatPosition);

        // Copilot Seat
        createChair(new THREE.Vector3(2.5, 0.8, -32), -0.15); // Angled slightly towards center

        // 11. Interactive Detailed Cockpit Dashboard Panel (Matching space combat layout!)
        const frameMat3D = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 60 });
        const trimMat3D = new THREE.MeshPhongMaterial({ color: 0x334155, shininess: 100 });

        // Glowing materials
        const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
        const greenGlow = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
        const orangeGlow = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const redGlow = new THREE.MeshBasicMaterial({ color: 0xff0055 });

        // Center dashboard is positioned relative to seat (seat is at z = -32, windshield is at z = -40)
        const dashboardZ = -34.5;
        const dashboardY = 0.8;

        // Left & Right tilted consoles
        const leftConsole = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.5), frameMat3D);
        leftConsole.position.set(-2.4, dashboardY, dashboardZ);
        leftConsole.rotation.set(0.2, 0.5, -0.15);
        this.interiorGroup.add(leftConsole);

        const rightConsole = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.5), frameMat3D);
        rightConsole.position.set(2.4, dashboardY, dashboardZ);
        rightConsole.rotation.set(0.2, -0.5, 0.15);
        this.interiorGroup.add(rightConsole);

        // Center console main desk
        const centerConsole = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 1.2), frameMat3D);
        centerConsole.position.set(0, dashboardY - 0.2, dashboardZ - 0.2);
        centerConsole.rotation.x = 0.15;
        this.interiorGroup.add(centerConsole);

        // Tilted holographic/glass screens
        const glassMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f3ff,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });

        const screenLeft = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), glassMaterial);
        screenLeft.position.set(-2.0, dashboardY + 0.7, dashboardZ + 0.2);
        screenLeft.rotation.set(0.15, 0.55, -0.1);
        this.interiorGroup.add(screenLeft);

        const screenRight = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), glassMaterial);
        screenRight.position.set(2.0, dashboardY + 0.7, dashboardZ + 0.2);
        screenRight.rotation.set(0.15, -0.55, 0.1);
        this.interiorGroup.add(screenRight);

        // Border frames for screen panels
        const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.6, 0.9));
        const borderMat = new THREE.LineBasicMaterial({ color: 0x00f3ff });
        const leftScreenBorder = new THREE.LineSegments(borderGeo, borderMat);
        leftScreenBorder.position.copy(screenLeft.position);
        leftScreenBorder.rotation.copy(screenLeft.rotation);
        this.interiorGroup.add(leftScreenBorder);

        const rightScreenBorder = new THREE.LineSegments(borderGeo, borderMat);
        rightScreenBorder.position.copy(screenRight.position);
        rightScreenBorder.rotation.copy(screenRight.rotation);
        this.interiorGroup.add(rightScreenBorder);

        // Add 3D control buttons on left console
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 2; j++) {
                const btnGeo = new THREE.BoxGeometry(0.1, 0.05, 0.1);
                const colors = [greenGlow, orangeGlow, cyanGlow, redGlow];
                const btnMat = colors[(i + j) % colors.length];
                const btn = new THREE.Mesh(btnGeo, btnMat);
                btn.position.set(-2.9 + i * 0.25, dashboardY + 0.5, dashboardZ - 0.1 + j * 0.25);
                btn.rotation.set(0.2, 0.5, -0.15);
                this.interiorGroup.add(btn);
            }
        }

        // Add 3D rotary dials on right console
        for (let i = 0; i < 3; i++) {
            const dialGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8);
            const dial = new THREE.Mesh(dialGeo, trimMat3D);
            dial.position.set(2.2 + i * 0.35, dashboardY + 0.5, dashboardZ);
            dial.rotation.set(0.5, -0.5, 0.15);
            
            const dialPointerGeo = new THREE.BoxGeometry(0.02, 0.06, 0.06);
            const dialPointer = new THREE.Mesh(dialPointerGeo, cyanGlow);
            dialPointer.position.set(0, 0.03, 0);
            dial.add(dialPointer);
            
            this.interiorGroup.add(dial);
        }

        // Add Flight Yoke / Steering columns
        const yokeColumnGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
        const yokeColumn = new THREE.Mesh(yokeColumnGeo, trimMat3D);
        yokeColumn.position.set(0, dashboardY + 0.1, dashboardZ + 0.3);
        yokeColumn.rotation.x = -0.5; // Angled towards seat
        this.interiorGroup.add(yokeColumn);

        const yokeHandleGeo = new THREE.TorusGeometry(0.25, 0.04, 8, 24, Math.PI); // Half-wheel yoke
        const yokeHandle = new THREE.Mesh(yokeHandleGeo, trimMat3D);
        yokeHandle.position.set(0, dashboardY + 0.5, dashboardZ + 0.5);
        yokeHandle.rotation.set(0.5, 0, Math.PI / 2);
        this.interiorGroup.add(yokeHandle);

        const yokeGripL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8), frameMat3D);
        yokeGripL.position.set(0.25, 0.0, 0.0);
        yokeHandle.add(yokeGripL);

        const yokeGripR = yokeGripL.clone();
        yokeGripR.position.x = -0.25;
        yokeHandle.add(yokeGripR);

        // Canopy framework struts (windshield pillars)
        const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.0, 0.2), trimMat3D);
        leftFrame.position.set(-3.2, 1.8, dashboardZ - 0.6);
        leftFrame.rotation.set(0.15, 0, -0.28);
        this.interiorGroup.add(leftFrame);

        const rightFrame = leftFrame.clone();
        rightFrame.position.x = 3.2;
        rightFrame.rotation.z = 0.28;
        this.interiorGroup.add(rightFrame);

        // Lower dash glowing neon pipeline
        const trimBar = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.04, 0.04), cyanGlow);
        trimBar.position.set(0, dashboardY + 0.3, dashboardZ + 0.15);
        this.interiorGroup.add(trimBar);

        // Top windshield frame bar
        const topFrameBar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.2, 0.2), trimMat3D);
        topFrameBar.position.set(0, 3.5, dashboardZ - 0.4);
        this.interiorGroup.add(topFrameBar);

        // Center strut running up the center window
        const centerStrut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), trimMat3D);
        centerStrut.position.set(0, dashboardY + 0.9, dashboardZ - 0.2);
        centerStrut.rotation.x = -0.2;
        this.interiorGroup.add(centerStrut);


        // === LIGHTING — PER-PIXEL PHONG — MATCHES ORIGINAL TEAL CORRIDOR LOOK ===
        // AmbientLight fills all dark areas with a faint blue-teal base. Increased brightness.
        const ambientLight = new THREE.AmbientLight(0x102030, 15.0);
        this.interiorGroup.add(ambientLight);

        // Directional overhead key light (adds broad, cheap illumination to the whole scene)
        const dirLight = new THREE.DirectionalLight(0xddeeff, 4.0);
        dirLight.position.set(0, 8, -10);
        this.interiorGroup.add(dirLight);

        // Ceiling strip PointLights — one per strip, intense cyan, wide enough to flood whole corridor
        const ceilingLightPositions = [-35, -25, -15, -5, 5, 15];
        ceilingLightPositions.forEach(z => {
            const stripLight = new THREE.PointLight(0x00d4ff, 6.0, 28);
            stripLight.position.set(0, 3.2, z);
            this.interiorGroup.add(stripLight);
        });

        // Reactor core glow (green-tinted, from the left alcove)
        const reactorLight = new THREE.PointLight(0x00ff88, 3.0, 12);
        reactorLight.position.set(-5.4, 2.0, 2.0);
        this.interiorGroup.add(reactorLight);

        // Dashboard/cockpit neon (intense cyan)
        const cockpitLight = new THREE.PointLight(0x00f3ff, 5.0, 22);
        cockpitLight.position.set(0, 1.5, -34);
        this.interiorGroup.add(cockpitLight);

        // Orange terminal glow
        const terminalLight = new THREE.PointLight(0xff6600, 2.0, 10);
        terminalLight.position.set(-3.4, 1.5, -19);
        this.interiorGroup.add(terminalLight);
    }

    /**
     * Attaches Pointer Lock API click triggers to the viewport.
     */
    bindPointerLock() {
        const container = document.getElementById('game-container');
        
        document.addEventListener('click', () => {
            if (this.active && !this.isLocked) {
                container.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = (document.pointerLockElement === container);
            const walkHud = document.getElementById('walk-instructions');
            if (walkHud) {
                if (this.isLocked) {
                    walkHud.classList.add('hidden');
                } else {
                    walkHud.classList.remove('hidden');
                }
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.active || !this.isLocked) return;

            // Sensitivity scaling
            const sensitivity = 0.0022 * this.mouseSensitivityMultiplier;
            this.player.yaw -= e.movementX * sensitivity;
            this.player.pitch -= e.movementY * sensitivity;

            // Clamp vertical look pitch
            this.player.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.player.pitch));
        });

        // Mouse wheel for third-person zoom
        document.addEventListener('wheel', (e) => {
            if (!this.active || this.player.viewMode !== 'thirdperson') return;
            this.player.cameraZoom += Math.sign(e.deltaY) * 0.5;
            this.player.cameraZoom = Math.max(1.5, Math.min(8.0, this.player.cameraZoom)); // Clamp zoom distance
        });
    }

    /**
     * Procedurally generates a diamond-plate or grid style floor texture
     */
    generateFloorTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base lighter metal for better visibility
        ctx.fillStyle = '#22222a';
        ctx.fillRect(0, 0, 512, 512);

        // Bright grid lines
        ctx.strokeStyle = '#333344';
        ctx.lineWidth = 6;
        for(let i = 0; i <= 512; i += 64) {
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i, 512);
            ctx.moveTo(0, i); ctx.lineTo(512, i);
            ctx.stroke();
        }

        // Glowing intersections (Cyan)
        ctx.fillStyle = '#00f3ff';
        for(let x = 0; x <= 512; x += 64) {
            for(let y = 0; y <= 512; y += 64) {
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI*2);
                ctx.fill();
            }
        }

        // Add some noise/scratches
        for(let i=0; i<800; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#444455' : '#050505';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 20); // Repeat down the long corridor
        return texture;
    }

    /**
     * Procedurally generates a paneled wall texture
     */
    generateWallTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Lighter grey base
        ctx.fillStyle = '#555566';
        ctx.fillRect(0, 0, 512, 512);

        // Dark Panel seams
        ctx.strokeStyle = '#111115';
        ctx.lineWidth = 8;
        
        // Horizontal seams
        ctx.beginPath();
        ctx.moveTo(0, 128); ctx.lineTo(512, 128);
        ctx.moveTo(0, 384); ctx.lineTo(512, 384);
        ctx.stroke();

        // Glowing caution stripe in the middle
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(0, 240, 512, 32);
        
        // Bright vertical rivets
        ctx.fillStyle = '#888899';
        for(let y of [110, 146, 366, 402]) {
            for(let x=32; x<512; x+=64) {
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI*2);
                ctx.fill();
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 1); // Repeat horizontally along the walls
        return texture;
    }

    /**
     * Procedurally generates a tech crate texture
     */
    generateCrateTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base grey
        ctx.fillStyle = '#666';
        ctx.fillRect(0, 0, 256, 256);

        // Dark border frame
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 16;
        ctx.strokeRect(8, 8, 240, 240);

        // Diagonal reinforcing bars
        ctx.beginPath();
        ctx.moveTo(8, 8); ctx.lineTo(248, 248);
        ctx.moveTo(248, 8); ctx.lineTo(8, 248);
        ctx.stroke();

        // Warning label
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(90, 110, 76, 36);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('H&H', 108, 135);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }



    /**
     * Enters walking state, resetting positions and showing instruct overlays.
     */
    enter(fromSeat = false) {
        this.active = true;
        this.interiorGroup.visible = true;
        
        // Reset player state
        this.player.reset(fromSeat);
        this.player.active = true;
        
        // Display walking instructions overlay
        const walkInstructions = document.getElementById('walk-instructions');
        if (walkInstructions) {
            walkInstructions.innerHTML = `
                <p>USE <span class="key">W / A / S / D</span> TO WALK | <span class="key">L-SHIFT</span> TO RUN</p>
                <p>USE <span class="key">SPACE</span> TO JUMP | <span class="key">V</span> TO TOGGLE 1ST/3RD PERSON VIEW</p>
                <p>CLICK SCREEN TO ENGAGE VIEW LOCK</p>
            `;
            walkInstructions.classList.remove('hidden');
        }
    }

    /**
     * Exits walking state and clears pointer locks.
     */
    exit() {
        this.active = false;
        this.interiorGroup.visible = false;
        this.player.active = false;
        this.isLocked = false;
        document.exitPointerLock();

        const walkInstructions = document.getElementById('walk-instructions');
        if (walkInstructions) walkInstructions.classList.add('hidden');
        
        const actionPrompt = document.getElementById('walk-action-prompt');
        if (actionPrompt) actionPrompt.classList.add('hidden');
    }

    /**
     * Triggers walk mechanics, collisions, triggers, and camera rotations.
     */
    update(deltaTime, keys) {
        if (!this.active) return;
        const now = deltaTime;

        // Delegate character movement and camera tracking updates
        this.player.update(now, keys);

        // Pilot Seat Interaction Trigger Check
        const distToSeat = this.player.position.distanceTo(this.seatPosition);
        const actionPrompt = document.getElementById('walk-action-prompt');

        if (distToSeat < 3.5) {
            if (!this.promptActive) {
                if (actionPrompt) actionPrompt.classList.remove('hidden');
                this.promptActive = true;
            }

            // Press [E] key to sit down and trigger space flight mode
            if (keys['e']) {
                this.sitInPilotSeat(keys);
            }
        } else {
            if (this.promptActive) {
                if (actionPrompt) actionPrompt.classList.add('hidden');
                this.promptActive = false;
            }
        }
    }

    /**
     * Executes the camera sitting transition and launches space flight mode.
     */
    sitInPilotSeat(keys) {
        if (this.player.isTransitioning) return;
        this.player.isTransitioning = true;

        const startPos = new THREE.Vector3(0, 0.0, -33.6); // Standing in front of seat at floor height
        const endPos = new THREE.Vector3().copy(this.seatPosition); // Elevated seat position (0, 0.8, -32.0)

        this.player.position.copy(startPos);
        if (this.player.characterMesh) {
            this.player.characterMesh.visible = true;
            this.player.characterMesh.position.copy(this.player.position);
            this.player.characterMesh.rotation.set(0, Math.PI, 0); // Face forward (out windshield)
        }
        this.player.playAnimation('idle_to_sit');

        // Smoothly animate transition position from floor standing to seated position
        let elapsed = 0;
        const duration = 1600; // 1.6 seconds
        const startTime = performance.now();

        const animateSitting = () => {
            const now = performance.now();
            elapsed = now - startTime;
            const t = Math.min(1.0, elapsed / duration);

            // Smooth ease-in-out curve
            const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

            this.player.position.lerpVectors(startPos, endPos, easeT);
            if (this.player.characterMesh) {
                this.player.characterMesh.position.copy(this.player.position);
            }

            if (t < 1.0) {
                requestAnimationFrame(animateSitting);
            } else {
                this.player.position.copy(endPos);
                if (this.player.characterMesh) {
                    this.player.characterMesh.position.copy(this.player.position);
                }

                // Disable walking updates
                this.active = false;
                this.player.active = false;
                document.exitPointerLock();

                // Play alarm sound
                this.audioSystem.playWarningAlarm();

                // Smooth camera lerp transition from character eye level to cockpit seat look-out
                const startCamPos = new THREE.Vector3().copy(this.camera.position);
                const startCamRot = new THREE.Quaternion().copy(this.camera.quaternion);

                const targetCamPos = new THREE.Vector3(0, 0.0, 0); // Center pilot location
                const targetCamRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)); // Look straight out windshield

                // Smooth camera lerp transition
                let alpha = 0;
                const transitionLoop = () => {
                    alpha += 0.035; // 0.8s total transition time (approx. 30 frames)
                    this.camera.position.lerpVectors(startCamPos, targetCamPos, alpha);
                    this.camera.quaternion.slerp(targetCamRot, alpha);

                    // Keep updating animation mixer for a smooth transition
                    if (this.player.mixer) {
                        this.player.mixer.update(0.016);
                    }

                    if (alpha < 1) {
                        requestAnimationFrame(transitionLoop);
                    } else {
                        // Play sitting loop animation
                        this.player.playAnimation('sit_idle');
                        // Complete sitting down sequence: trigger main game play
                        this.exit();
                        window.gameApp.transitionToFlight();
                    }
                };
                
                transitionLoop();
            }
        };

        animateSitting();
    }
}
window.InteriorManager = InteriorManager;
