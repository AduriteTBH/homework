/**
 * H&H Invaders - Interior Walking Manager
 * Handles the walk-around spaceship phase.
 * Manages procedural cabin rendering, Pointer Lock controls, WASD/mouse third-person camera movement,
 * collision bounds, GLTFLoader character loading, animation blending, and seat transition triggers.
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

        // Movement parameters (Floor height is y = 0)
        this.playerPosition = new THREE.Vector3(0, 0, 20); // Spawn at back of corridor
        this.playerVelocity = new THREE.Vector3(0, 0, 0);
        this.playerYaw = 0;   // Horizontal rotation
        this.playerPitch = 0.1; // Vertical rotation (slightly look down)
        
        this.eyeHeight = 1.45; // Eye height in 1st person
        this.walkSpeed = 4.5;
        this.runSpeed = 9.0;
        this.damping = 10.0; // Slide friction
        this.isJumping = false;
        this.jumpVelocity = 9.0;

        // Bounding boxes for walk boundaries
        // Corridor: x between -4 and 4, y between 0 and 3, z between -40 and 25
        this.bounds = {
            minX: -3.5, maxX: 3.5,
            minZ: -38, maxZ: 22,
            minY: 0, maxY: 3.5
        };

        // Pointer Lock State
        this.isLocked = false;
        
        // Pilot Seat location
        this.seatPosition = new THREE.Vector3(0, 0.8, -32);
        this.promptActive = false;

        // View Mode: 'thirdperson' (default, to show character) or 'firstperson'
        this.viewMode = 'thirdperson';
        this.vKeyPressed = false;
        this.cameraZoom = 4.0; // Default third-person camera distance
        this.headBobTimer = 0;

        // Character GLTF Loading parameters
        this.loader = new window.GLTFLoader();
        this.characterMesh = null;
        this.companionMesh = null;
        this.mixer = null; // Animation mixer for player character
        this.clock = new THREE.Clock();
        this.gltfAnimations = [];
        this.currentActionName = '';
        this.currentAction = null;
        this.lastAngle = Math.PI; // Default to facing away from camera

        this.initInteriorScene();
        this.bindPointerLock();
    }

    /**
     * Hides or shows the character's head bone to prevent camera clipping in first person view.
     */
    setHeadVisibility(visible) {
        if (!this.characterMesh) return;
        const scale = visible ? 1 : 0.001;
        this.characterMesh.traverse((child) => {
            if (child.isBone) {
                const name = child.name.toLowerCase();
                // ONLY hide head, hair, face. DO NOT hide neck, as it deforms the chest!
                if (name.includes('head') || name.includes('hair') || name.includes('face') || name.includes('eye') || name.includes('jaw')) {
                    child.scale.set(scale, scale, scale);
                }
            }
        });
    }

    /**
     * Procedurally constructs the spaceship interior (corridor, doors, lights, cockpit seat).
     */
    initInteriorScene() {
        // Materials
        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x27272a, // Dark slate
            roughness: 0.6,
            metalness: 0.8,
            flatShading: true
        });

        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x18181b, // Almost black
            roughness: 0.9,
            metalness: 0.3
        });

        const lightMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff }); // Cyan neon strip lights
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x0ea5e9,
            transparent: true,
            opacity: 0.3,
            roughness: 0.1
        });

        // 1. Floor Panels (z = -45 to 30)
        const floorGeom = new THREE.BoxGeometry(8, 0.1, 75);
        const floorMesh = new THREE.Mesh(floorGeom, floorMat);
        floorMesh.position.set(0, -0.05, -7.5);
        this.interiorGroup.add(floorMesh);

        // 2. Ceiling Panels
        const ceilingGeom = new THREE.BoxGeometry(8, 0.1, 75);
        const ceilingMesh = new THREE.Mesh(ceilingGeom, metalMat);
        ceilingMesh.position.set(0, 3.5, -7.5);
        this.interiorGroup.add(ceilingMesh);

        // 3. Walls (Left & Right)
        const wallHeight = 3.5;
        const wallThickness = 0.2;
        const wallLength = 75;
        
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallLength), metalMat);
        leftWall.position.set(-4, wallHeight / 2, -7.5);
        this.interiorGroup.add(leftWall);

        const rightWall = leftWall.clone();
        rightWall.position.x = 4;
        this.interiorGroup.add(rightWall);

        // 4. End walls (Back door and front cockpit windshield)
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(8, wallHeight, wallThickness), metalMat);
        backWall.position.set(0, wallHeight / 2, 25);
        this.interiorGroup.add(backWall);

        const frontWindshield = new THREE.Mesh(new THREE.BoxGeometry(8, 2, wallThickness), glassMat);
        frontWindshield.position.set(0, 2.5, -40);
        this.interiorGroup.add(frontWindshield);

        const frontLowerWall = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, wallThickness), metalMat);
        frontLowerWall.position.set(0, 0.75, -40);
        this.interiorGroup.add(frontLowerWall);

        // 5. Procedural Light strips on Ceiling
        for (let z = -35; z <= 20; z += 10) {
            const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(3, 0.02, 0.2), lightMat);
            lightStrip.position.set(0, 3.44, z);
            this.interiorGroup.add(lightStrip);
        }

        // 6. Pilot & Co-Pilot Chairs
        const chairBaseMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.8 });
        const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), chairBaseMat);
        seatMesh.position.copy(this.seatPosition);
        this.interiorGroup.add(seatMesh);

        const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.2), chairBaseMat);
        seatBack.position.set(this.seatPosition.x, this.seatPosition.y + 0.7, this.seatPosition.z + 0.5);
        this.interiorGroup.add(seatBack);

        // Co-pilot seat (right side) for character placement
        const copilotSeat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), chairBaseMat);
        copilotSeat.position.set(2, 0.8, -32);
        this.interiorGroup.add(copilotSeat);

        const copilotSeatBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.2), chairBaseMat);
        copilotSeatBack.position.set(2, 1.5, -31.5);
        this.interiorGroup.add(copilotSeatBack);

        // 7. Cockpit Dashboard panel
        const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.0, 1.5), metalMat);
        consoleMesh.position.set(0, 0.9, -38);
        this.interiorGroup.add(consoleMesh);

        // Spawn a procedural co-pilot companion in the copilot seat
        this.createCompanionPlaceholder(new THREE.Vector3(2, 0.8, -32));

        // 8. Lights inside the corridor to brighten the scene
        const ambientInteriorLight = new THREE.AmbientLight(0xffffff, 4.0); // Bright general white ambient
        this.interiorGroup.add(ambientInteriorLight);

        const dirInteriorLight = new THREE.DirectionalLight(0xffffff, 3.5);
        dirInteriorLight.position.set(0, 4.5, 0); // Directly overhead
        this.interiorGroup.add(dirInteriorLight);

        // Add actual glowing point lights at each light strip to give highlights on the metal structure and player
        for (let z = -35; z <= 20; z += 10) {
            const pointLight = new THREE.PointLight(0x00f3ff, 4.0, 15, 0.5);
            pointLight.position.set(0, 3.2, z);
            this.interiorGroup.add(pointLight);
        }
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

        // Track mouse movements to rotate camera look vector
        document.addEventListener('mousemove', (e) => {
            if (!this.active || !this.isLocked) return;

            // Sensitivity scaling
            const sensitivity = 0.0022;
            this.playerYaw -= e.movementX * sensitivity;
            this.playerPitch -= e.movementY * sensitivity;

            // Clamp vertical look pitch to avoid flipping upside down, but allow looking almost straight down (85 degrees)
            this.playerPitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.playerPitch));
        });

        // Mouse wheel for third-person zoom
        document.addEventListener('wheel', (e) => {
            if (!this.active || this.viewMode !== 'thirdperson') return;
            this.cameraZoom += Math.sign(e.deltaY) * 0.5;
            this.cameraZoom = Math.max(1.5, Math.min(8.0, this.cameraZoom)); // Clamp zoom distance
        });
    }

    /**
     * Loads the rigged GLTF female character model.
     * Searches for assets/scene.gltf. Fallback stays active if file does not exist.
     */
    loadCharacterModel() {
        if (this.characterMesh && this.gltfAnimations.length > 0) {
            this.characterMesh.position.copy(this.playerPosition);
            this.characterMesh.rotation.set(0, Math.PI, 0); // Face forward initially
            this.playAnimation('idle');
            return;
        }

        this.loader.load(
            'assets/scene.gltf',
            (gltf) => {
                // Success: remove placeholder and bind loaded character
                if (this.characterMesh) {
                    this.interiorGroup.remove(this.characterMesh);
                }

                const model = gltf.scene;
                
                // Wrap model in a group to separate velocity rotation from skeletal animation root rotation
                const characterContainer = new THREE.Group();
                characterContainer.position.copy(this.playerPosition);
                characterContainer.rotation.set(0, Math.PI, 0); // Container initially faces forward (-Z)
                characterContainer.scale.set(1.1, 1.1, 1.1);
                
                // Fix GLTF transparency depth sorting issues
                model.traverse((child) => {
                    if (child.isMesh && child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(mat => {
                            if (mat.transparent) {
                                mat.transparent = false;
                                mat.alphaTest = 0.5;
                                mat.depthWrite = true;
                                mat.side = THREE.DoubleSide;
                                mat.needsUpdate = true;
                            }
                        });
                    }
                });

                characterContainer.add(model);

                this.interiorGroup.add(characterContainer);
                this.characterMesh = characterContainer;
                this.gltfAnimations = gltf.animations;

                // Handle animations if available
                if (gltf.animations && gltf.animations.length > 0) {
                    console.log("Loaded character animations:", gltf.animations.map(a => a.name));
                    this.mixer = new THREE.AnimationMixer(model);
                    this.playAnimation('idle');
                }

                console.log("Player female character GLTF loaded successfully.");
            },
            undefined,
            (err) => {
                console.error("Error loading assets/scene.gltf:", err);
                console.warn("Using procedural placeholder instead.");
                // Ensure placeholder is active
                if (!this.characterMesh) {
                    this.createCharacterPlaceholder(this.playerPosition);
                }
            }
        );
    }

    /**
     * Smoothly crossfades between animation clips.
     */
    playAnimation(name) {
        if (!this.mixer || !this.gltfAnimations || this.gltfAnimations.length === 0) return;
        if (this.currentActionName === name) return;

        const clip = this.gltfAnimations.find(a => a.name === name);
        if (!clip) {
            console.warn(`Animation clip "${name}" not found.`);
            return;
        }

        const newAction = this.mixer.clipAction(clip);
        newAction.reset();
        newAction.enabled = true;
        newAction.setEffectiveTimeScale(1);
        newAction.setEffectiveWeight(1);

        if (this.currentAction) {
            newAction.crossFadeFrom(this.currentAction, 0.25, true);
        }
        newAction.play();
        this.currentAction = newAction;
        this.currentActionName = name;
    }

    /**
     * Spawns a low-poly procedural female figure as a player fallback.
     */
    createCharacterPlaceholder(position) {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.5 }); // Rose red jumpsuit
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 }); // Skin peach
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 }); // Black hair

        const characterGroup = new THREE.Group();

        // Torso
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.9, 8), bodyMat);
        torso.position.set(0, 0.45, 0);
        characterGroup.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), skinMat);
        head.position.set(0, 1.05, 0);
        characterGroup.add(head);

        // Hair
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), hairMat);
        hair.position.set(0, 1.1, 0.03);
        characterGroup.add(hair);

        // Position character group
        characterGroup.position.copy(position);
        this.interiorGroup.add(characterGroup);
        this.characterMesh = characterGroup;
    }

    /**
     * Spawns a low-poly procedural figure in the copilot seat as an NPC.
     */
    createCompanionPlaceholder(position) {
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.5 }); // Sky blue jumpsuit
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 }); // Skin peach
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 }); // Brown hair

        const characterGroup = new THREE.Group();

        // Torso
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.9, 8), bodyMat);
        torso.position.set(0, 0.45, 0);
        characterGroup.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), skinMat);
        head.position.set(0, 1.05, 0);
        characterGroup.add(head);

        // Hair
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), hairMat);
        hair.position.set(0, 1.1, 0.03);
        characterGroup.add(hair);

        // Arms/Legs in sitting configuration
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.7), bodyMat);
        leg.position.set(-0.2, 0.2, -0.3);
        characterGroup.add(leg);

        const legR = leg.clone();
        legR.position.x = 0.2;
        characterGroup.add(legR);

        // Position NPC in co-pilot seat
        characterGroup.position.copy(position);
        characterGroup.rotation.y = Math.PI; // Face forward

        this.interiorGroup.add(characterGroup);
        this.companionMesh = characterGroup;
    }

    /**
     * Starts the Walking state and unlocks screen constraints.
     */
    enter() {
        this.active = true;
        this.interiorGroup.visible = true;
        
        // Spawn player at back of hallway corridor (floor level)
        this.playerPosition.set(0, 0, 20);
        this.playerVelocity.set(0, 0, 0);
        this.playerYaw = 0;
        this.playerPitch = 0.1;
        this.isJumping = false;
        
        // Attempt to load GLTF character
        this.loadCharacterModel();
        
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

        // 1. View Mode toggle with 'v' key
        if (keys['v'] && !this.vKeyPressed) {
            this.viewMode = this.viewMode === 'firstperson' ? 'thirdperson' : 'firstperson';
            this.setHeadVisibility(this.viewMode === 'thirdperson');
            this.vKeyPressed = true;
        }
        if (!keys['v']) {
            this.vKeyPressed = false;
        }

        // 2. Update GLTF animations
        if (this.mixer) {
            this.mixer.update(now);
        }

        // 3. Movement input calculation (relative to camera yaw)
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.playerYaw);
        
        let moveDir = new THREE.Vector3(0, 0, 0);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQuat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQuat);

        if (keys['w']) moveDir.add(forward);
        if (keys['s']) moveDir.addScaledVector(forward, -1);
        if (keys['d']) moveDir.add(right);
        if (keys['a']) moveDir.addScaledVector(right, -1);

        const moving = moveDir.lengthSq() > 0.001;
        if (moving) {
            moveDir.normalize();
        }

        // Determine speed and animation based on Shift key
        const running = keys['shift'];
        const currentSpeed = running ? this.runSpeed : this.walkSpeed;

        if (moving) {
            const targetVel = new THREE.Vector3().copy(moveDir).multiplyScalar(currentSpeed);
            this.playerVelocity.x = THREE.MathUtils.lerp(this.playerVelocity.x, targetVel.x, this.damping * now);
            this.playerVelocity.z = THREE.MathUtils.lerp(this.playerVelocity.z, targetVel.z, this.damping * now);
        } else {
            this.playerVelocity.x = THREE.MathUtils.lerp(this.playerVelocity.x, 0, this.damping * now);
            this.playerVelocity.z = THREE.MathUtils.lerp(this.playerVelocity.z, 0, this.damping * now);
        }

        // 4. Handle Jumping Physics
        if (keys[' '] && !this.isJumping) {
            this.playerVelocity.y = this.jumpVelocity;
            this.isJumping = true;
            this.playAnimation('jump_start');
        }

        if (this.isJumping) {
            this.playerVelocity.y -= 25.0 * now; // Gravity
            this.playerPosition.y += this.playerVelocity.y * now;
            
            if (this.playerPosition.y <= 0) {
                this.playerPosition.y = 0;
                this.playerVelocity.y = 0;
                this.isJumping = false;
                
                // Play landing transition
                if (moving) {
                    this.playAnimation(running ? 'run' : 'walk');
                } else {
                    this.playAnimation('idle');
                }
            } else {
                // If in mid-air, play jump loop
                if (this.playerVelocity.y < 3.0) {
                    this.playAnimation('jump_loop');
                }
            }
        } else {
            // Update movement animations if on floor
            if (moving) {
                this.playAnimation(running ? 'run' : 'walk');
            } else {
                this.playAnimation('idle');
            }
        }

        // Apply movement vector to coordinates
        this.playerPosition.x += this.playerVelocity.x * now;
        this.playerPosition.z += this.playerVelocity.z * now;

        // Collision boundary clamping
        this.playerPosition.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.playerPosition.x));
        this.playerPosition.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.playerPosition.z));

        // 5. Position & Rotate the Character Mesh
        if (this.characterMesh) {
            this.characterMesh.position.copy(this.playerPosition);
            
            if (this.viewMode === 'firstperson') {
                // In first person, the body must ALWAYS turn to match the camera's yaw so we can see our body when looking down
                this.lastAngle = this.playerYaw + Math.PI;
                this.characterMesh.rotation.y = this.lastAngle;
                if (moving) this.headBobTimer += now * currentSpeed * 1.5;
                else this.headBobTimer = THREE.MathUtils.lerp(this.headBobTimer, 0, now * 5.0);
            } else {
                if (moving) {
                    // Determine rotation angle based on movement direction
                    this.lastAngle = Math.atan2(this.playerVelocity.x, this.playerVelocity.z);
                    this.characterMesh.rotation.y = this.lastAngle;
                    this.headBobTimer += now * currentSpeed * 1.5;
                } else {
                    this.characterMesh.rotation.y = this.lastAngle;
                    this.headBobTimer = THREE.MathUtils.lerp(this.headBobTimer, 0, now * 5.0);
                }
            }
        }
        
        // Compute head bob offset (a subtle sine wave on the Y axis)
        const bobY = Math.sin(this.headBobTimer) * 0.08;

        // 6. Camera Position & Orientation (First-Person vs Third-Person)
        const cameraQuat = new THREE.Quaternion().copy(yawQuat).multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.playerPitch)
        );

        if (this.viewMode === 'firstperson') {
            // First Person: Camera exactly at real eye level (approx 1.60 for this model).
            const bodyForward = new THREE.Vector3(Math.sin(this.lastAngle), 0, Math.cos(this.lastAngle));
            
            // Dynamically adjust offset: 0.22 for walking (to see arms), 0.45 for jumping (to avoid extreme head bob)
            const targetOffset = this.playerIsOnFloor ? 0.22 : 0.45;
            this.firstPersonOffset = THREE.MathUtils.lerp(this.firstPersonOffset || 0.22, targetOffset, now * 15);
            
            const forwardOffset = bodyForward.multiplyScalar(this.firstPersonOffset); 
            
            this.camera.position.copy(this.playerPosition)
                .add(new THREE.Vector3(0, this.eyeHeight + bobY + 0.15, 0)) // Keeping exactly the same height as requested
                .add(forwardOffset);
            this.camera.quaternion.copy(cameraQuat);
            
            // Decrease near clipping plane to stop slicing the chest open, rely on offset to hide nose
            if (this.camera.fov !== 100 || this.camera.near !== 0.05) {
                this.camera.fov = 100; // Wide FOV for immersion and arm visibility
                this.camera.near = 0.05; // Dropped to 0.05 to stop slicing the chest open
                this.camera.updateProjectionMatrix();
            }
            
            // Keep mesh visible in first person!
            if (this.characterMesh) this.characterMesh.visible = true;
        } else {
            // Restore FOV and near clipping plane for third person
            if (this.camera.fov !== 75 || this.camera.near !== 0.1) {
                this.camera.fov = 75;
                this.camera.near = 0.1;
                this.camera.updateProjectionMatrix();
            }

            // Third Person: Camera behind player looking forward
            if (this.characterMesh) this.characterMesh.visible = true;

            const lookDir = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraQuat); // direction pointing back from player
            const cameraTargetPos = new THREE.Vector3().copy(this.playerPosition)
                .add(new THREE.Vector3(0, 1.3 + bobY, 0)) // Look target is player chest + bob
                .addScaledVector(lookDir, this.cameraZoom); // Use dynamic zoom distance
                
            // Prevent camera from clipping through the walls
            cameraTargetPos.x = Math.max(this.bounds.minX + 0.5, Math.min(this.bounds.maxX - 0.5, cameraTargetPos.x));
            cameraTargetPos.z = Math.max(this.bounds.minZ + 0.5, Math.min(this.bounds.maxZ - 0.5, cameraTargetPos.z));
            
            // Prevent camera from clipping through the floor when looking up from low angle
            cameraTargetPos.y = Math.max(0.2, cameraTargetPos.y);

            this.camera.position.copy(cameraTargetPos);
            this.camera.quaternion.copy(cameraQuat);
        }

        // 7. Pilot Seat Interaction Trigger Check
        const distToSeat = this.playerPosition.distanceTo(this.seatPosition);
        const actionPrompt = document.getElementById('walk-action-prompt');

        if (distToSeat < 3.5) {
            if (!this.promptActive) {
                if (actionPrompt) actionPrompt.classList.remove('hidden');
                this.promptActive = true;
            }

            // Press [E] key to sit down and trigger space flight mode
            if (keys['e']) {
                this.sitInPilotSeat();
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
    sitInPilotSeat() {
        // Disable walking updates immediately
        this.active = false;
        document.exitPointerLock();

        // Play hatch opening / button tick sound
        this.audioSystem.playWarningAlarm();

        // Position player avatar in pilot seat and play sit animation
        if (this.characterMesh) {
            this.characterMesh.visible = true;
            this.characterMesh.position.copy(this.seatPosition);
            this.characterMesh.rotation.set(0, Math.PI, 0); // Face forward (out windshield)
            this.playAnimation('sit_idle');
        }

        // Smooth camera lerp transition from third-person to cockpit seat look-out
        const startCamPos = new THREE.Vector3().copy(this.camera.position);
        const startCamRot = new THREE.Quaternion().copy(this.camera.quaternion);

        const targetCamPos = new THREE.Vector3(0, 0.0, 0); // Center pilot location
        const targetCamRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)); // Look straight out windshield

        // Smooth camera lerp transition
        let alpha = 0;
        const transitionLoop = () => {
            alpha += 0.04;
            this.camera.position.lerpVectors(startCamPos, targetCamPos, alpha);
            this.camera.quaternion.slerp(targetCamRot, alpha);

            // Keep updating animation mixer for a smooth transition
            if (this.mixer) {
                this.mixer.update(0.016);
            }

            if (alpha < 1) {
                requestAnimationFrame(transitionLoop);
            } else {
                // Complete sitting down sequence: trigger main game play
                this.exit();
                window.gameApp.transitionToFlight();
            }
        };
        
        transitionLoop();
    }
}
window.InteriorManager = InteriorManager;
