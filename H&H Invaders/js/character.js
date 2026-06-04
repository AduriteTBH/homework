/**
 * H&H Invaders - Interior Character Controller
 * Manages the player's walking avatar, GLTF model loading, keyboard movement physics,
 * camera tracking (1st/3rd person view), skeletal animation mixers, and collision boundaries.
 */
export class InteriorPlayer {
    constructor(scene, camera, bounds, seatPosition, audioSystem) {
        this.scene = scene;
        this.camera = camera;
        this.bounds = bounds;
        this.seatPosition = seatPosition;
        this.audioSystem = audioSystem;

        // Position parameters (Spawn at back of corridor)
        this.position = new THREE.Vector3(0, 0, 20);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0.1;

        this.eyeHeight = 1.45; // Eye height in 1st person
        this.walkSpeed = 2.2; // Significantly lowered to perfectly sync with animation
        this.runSpeed = 5.5; // Slightly faster run
        this.damping = 10.0; // Slide friction
        this.isJumping = false;
        this.jumpVelocity = 11.0;

        // View configuration
        this.viewMode = 'thirdperson'; // 'firstperson' or 'thirdperson'
        this.vKeyPressed = false;
        this.cameraZoom = 2.8; // Well-balanced default zoom
        this.headBobTimer = 0;
        this.firstPersonOffset = 0.22;
        this.cameraInitialized = false;
        this.idleTimer = 0;
        this.nextIdleTime = 5.0;
        this.isTransitioning = false;


        // Rigged female character assets
        this.loader = new window.GLTFLoader();
        this.characterMesh = null;
        this.mixer = null;
        this.gltfAnimations = [];
        this.currentActionName = '';
        this.currentAction = null;
        this.lastAngle = Math.PI; // Default to facing forward (-Z direction)

        // Collision boundaries for ship interior decorations with heights (maxY)
        this.obstacles = [
            // Left Wall static segments (creating the Engineering Alcove from z = -2 to 6)
            { minX: -6.5, maxX: -3.8, minZ: -38.0, maxZ: -2.0, maxY: 3.5 },
            { minX: -6.5, maxX: -3.8, minZ: 6.0, maxZ: 25.0, maxY: 3.5 },

            // Right Wall static segments (creating the Bunk Alcove from z = -16 to -8)
            { minX: 3.8, maxX: 6.5, minZ: -38.0, maxZ: -16.0, maxY: 3.5 },
            { minX: 3.8, maxX: 6.5, minZ: -8.0, maxZ: 25.0, maxY: 3.5 },

            // Engineering Alcove Side Wall 1
            { minX: -6.5, maxX: -4.0, minZ: -2.1, maxZ: -1.9, maxY: 3.5 },
            // Engineering Alcove Side Wall 2
            { minX: -6.5, maxX: -4.0, minZ: 5.9, maxZ: 6.1, maxY: 3.5 },

            // Bunk Alcove Side Wall 1
            { minX: 4.0, maxX: 6.5, minZ: -16.1, maxZ: -15.9, maxY: 3.5 },
            // Bunk Alcove Side Wall 2
            { minX: 4.0, maxX: 6.5, minZ: -8.1, maxZ: -7.9, maxY: 3.5 },

            // Engineering Reactor Core (Inside Left Alcove)
            { minX: -6.0, maxX: -4.8, minZ: 0.5, maxZ: 3.5, maxY: 3.5 },

            // Double Bunk Bed (Inside Right Alcove)
            { minX: 4.5, maxX: 6.2, minZ: -15.0, maxZ: -9.0, maxY: 2.0 },

            // Cargo crates and cabinets
            { minX: -3.5, maxX: -2.2, minZ: 8.0, maxZ: 10.0, maxY: 1.75 },   // Cargo Crate stack (Left side)
            { minX: 2.2, maxX: 3.5, minZ: -6.0, maxZ: -4.0, maxY: 1.0 }, // Cargo Crate (Right side)
            { minX: -3.8, maxX: -3.2, minZ: -20.0, maxZ: -18.0, maxY: 1.8 }, // Computer Terminal cabinet
            
            // Cockpit chairs
            { minX: 1.3, maxX: 2.7, minZ: -32.8, maxZ: -31.2, maxY: 0.8 },  // Co-pilot chair
            { minX: -0.7, maxX: 0.7, minZ: -32.6, maxZ: -31.0, maxY: 1.5 }, // Pilot chair back support

            // Massive Dashboard / Front Console block
            // This prevents the player from squeezing past the chairs and walking into the windshield
            { minX: -8.0, maxX: 8.0, minZ: -42.0, maxZ: -33.5, maxY: 3.5 }
        ];

        // Cinematic entry camera state
        this.cinematicIntro = true;
        this.cinematicTime = 0;
        this.cinematicDuration = 1.8; // 1.8 seconds smooth sweep

        this.active = false;
    }

    /**
     * Initializes or resets player state when starting the walking phase.
     */
    reset(fromSeat = false) {
        if (fromSeat) {
            const startPos = new THREE.Vector3().copy(this.seatPosition);
            const endPos = new THREE.Vector3(0, 0.0, -30.6); // Stand right behind pilot seat on floor

            this.position.copy(startPos);
            this.velocity.set(0, 0, 0);
            this.yaw = 0;
            this.pitch = 0.1;
            this.isJumping = false;
            this.viewMode = 'thirdperson';
            this.cameraZoom = 2.8;
            this.cameraInitialized = false;
            this.smoothedPlayerPos = null;
            this.idleTimer = 0;
            this.nextIdleTime = 5.0;
            this.isTransitioning = true; // Lock controls while standing up
            this.lastAngle = Math.PI; // Face forward
            
            this.cinematicIntro = false; // No cinematic when standing up
            this.cinematicTime = 0;
            
            this.loadCharacterModel();
            if (this.characterMesh) {
                this.characterMesh.position.copy(this.position);
                this.characterMesh.rotation.set(0, Math.PI, 0);
            }
            this.playAnimation('sit_to idle');

            // Smoothly animate transition position from seat to behind seat
            let elapsed = 0;
            const duration = 1600; // 1.6 seconds
            const startTime = performance.now();

            const animateStanding = () => {
                const now = performance.now();
                elapsed = now - startTime;
                const t = Math.min(1.0, elapsed / duration);

                // Smooth ease-out curve
                const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                this.position.lerpVectors(startPos, endPos, easeT);
                if (this.characterMesh) {
                    this.characterMesh.position.copy(this.position);
                }

                if (t < 1.0) {
                    requestAnimationFrame(animateStanding);
                } else {
                    this.position.copy(endPos);
                    if (this.characterMesh) {
                        this.characterMesh.position.copy(this.position);
                    }
                    this.isTransitioning = false;
                }
            };

            animateStanding();
        } else {
            this.position.set(0, 0, 20);
            this.velocity.set(0, 0, 0);
            this.yaw = 0;
            this.pitch = 0.1;
            this.isJumping = false;
            this.viewMode = 'thirdperson';
            this.cameraZoom = 2.8;
            this.cameraInitialized = false;
            this.smoothedPlayerPos = null;
            this.idleTimer = 0;
            this.nextIdleTime = 5.0;
            this.isTransitioning = false;
            
            this.cinematicIntro = true;
            this.cinematicTime = 0;
            
            this.loadCharacterModel();
        }
    }


    /**
     * Toggles visibility of the head bones so they don't clip the camera in 1st person view.
     */
    setHeadVisibility(visible) {
        if (!this.characterMesh) return;
        const scale = visible ? 1 : 0.001;
        this.characterMesh.traverse((child) => {
            if (child.isBone) {
                const name = child.name.toLowerCase();
                // Hide head, hair, face, eyes, jaw bones. Keep neck intact to avoid skeletal collapse.
                if (name.includes('head') || name.includes('hair') || name.includes('face') || name.includes('eye') || name.includes('jaw')) {
                    child.scale.set(scale, scale, scale);
                }
            }
        });
    }

    /**
     * Loads the rigged GLTF female character model, or builds a procedural fallback.
     */
    loadCharacterModel() {
        if (this.characterMesh && this.gltfAnimations.length > 0) {
            this.characterMesh.position.copy(this.position);
            this.characterMesh.rotation.set(0, Math.PI, 0);
            this.playAnimation('idle');
            this.setHeadVisibility(this.viewMode === 'thirdperson');
            return;
        }

        this.loader.load(
            'assets/scene.gltf',
            (gltf) => {
                if (this.characterMesh) {
                    this.scene.remove(this.characterMesh);
                }

                const model = gltf.scene;
                
                // Outer group container for alignment
                const characterContainer = new THREE.Group();
                characterContainer.position.copy(this.position);
                characterContainer.rotation.set(0, Math.PI, 0);
                characterContainer.scale.set(1.1, 1.1, 1.1);
                
                // Fix GLTF transparency rendering sorting and optionally boost brightness
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

                // === CINEMATIC 3-POINT CHARACTER LIGHTING ===
                // Key Light: Soft warm light from the front-right (Bright, slightly toned down)
                const keyLight = new THREE.PointLight(0xffeedd, 1.1, 6);
                keyLight.position.set(1.5, 1.5, 1.5);
                characterContainer.add(keyLight);

                // Fill Light: Soft cyan light from the front-left to match the corridor ambiance
                const fillLight = new THREE.PointLight(0x00f3ff, 0.7, 6);
                fillLight.position.set(-1.5, 1.0, 1.5);
                characterContainer.add(fillLight);

                // Rim Light: Strong orange light from behind to make the silhouette pop
                const rimLight = new THREE.PointLight(0xff6600, 1.6, 6);
                rimLight.position.set(0, 1.5, -2.0);
                characterContainer.add(rimLight);

                characterContainer.add(model);
                this.scene.add(characterContainer);
                this.characterMesh = characterContainer;
                this.gltfAnimations = gltf.animations;

                if (gltf.animations && gltf.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(model);
                    this.playAnimation('idle');
                }
                
                this.setHeadVisibility(this.viewMode === 'thirdperson');
                console.log("InteriorPlayer GLTF character mounted.");
            },
            undefined,
            (err) => {
                console.warn("Rigged GLTF character scene load failed, spawning fallback.");
                if (!this.characterMesh) {
                    this.createCharacterPlaceholder(this.position);
                }
            }
        );
    }

    /**
     * Builds a simple procedural low-poly female pilot placeholder as a fallback mesh.
     */
    createCharacterPlaceholder(position) {
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xe11d48, shininess: 10 });
        const skinMat = new THREE.MeshPhongMaterial({ color: 0xffedd5, emissive: 0x150805, shininess: 5 });
        const hairMat = new THREE.MeshPhongMaterial({ color: 0x18181b, shininess: 15 });

        const characterGroup = new THREE.Group();

        // === CINEMATIC 3-POINT CHARACTER LIGHTING ===
        // Key Light: Soft warm light from the front-right
        const keyLight = new THREE.PointLight(0xffeedd, 1.2, 5);
        keyLight.position.set(1.5, 1.5, 1.5);
        characterGroup.add(keyLight);

        // Fill Light: Soft cyan light from the front-left to match the corridor ambiance
        const fillLight = new THREE.PointLight(0x00f3ff, 0.8, 5);
        fillLight.position.set(-1.5, 1.0, 1.5);
        characterGroup.add(fillLight);

        // Rim Light: Strong orange light from behind to make the silhouette pop
        const rimLight = new THREE.PointLight(0xff6600, 2.0, 5);
        rimLight.position.set(0, 1.5, -2.0);
        characterGroup.add(rimLight);

        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.9, 8), bodyMat);
        torso.position.set(0, 0.45, 0);
        characterGroup.add(torso);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), skinMat);
        head.position.set(0, 1.05, 0);
        characterGroup.add(head);

        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 8), hairMat);
        hair.position.set(0, 1.1, 0.03);
        characterGroup.add(hair);

        characterGroup.position.copy(position);
        this.scene.add(characterGroup);
        this.characterMesh = characterGroup;
    }

    /**
     * Blends transition between animation clips.
     */
    playAnimation(name) {
        if (!this.mixer || !this.gltfAnimations || this.gltfAnimations.length === 0) return;
        if (this.currentActionName === name) return;

        const clip = this.gltfAnimations.find(a => a.name === name);
        if (!clip) return;

        const newAction = this.mixer.clipAction(clip);
        const duration = 0.35; // smooth blend duration

        if (this.currentAction) {
            const prevAction = this.currentAction;
            newAction.reset();
            newAction.enabled = true;
            newAction.setEffectiveTimeScale(1);
            newAction.setEffectiveWeight(1);
            prevAction.crossFadeTo(newAction, duration, true);
            newAction.play();
        } else {
            newAction.reset();
            newAction.enabled = true;
            newAction.setEffectiveWeight(1);
            newAction.setEffectiveTimeScale(1);
            newAction.play();
        }
        this.currentAction = newAction;
        this.currentActionName = name;
    }

    /**
     * Governs player movement controls, jumping physics, and updates the camera state.
     */
    update(dt, keys) {
        // Determine the dynamic floor level height based on obstacles underneath the player
        let floorHeight = 0;
        this.obstacles.forEach(obs => {
            const margin = 0.15; // horizontal overlap padding
            if (this.position.x > obs.minX - margin && this.position.x < obs.maxX + margin &&
                this.position.z > obs.minZ - margin && this.position.z < obs.maxZ + margin) {
                // If player is falling or close to the top of the obstacle, resolve height floor
                if (this.position.y >= obs.maxY - 0.25) {
                    if (obs.maxY > floorHeight) {
                        floorHeight = obs.maxY;
                    }
                }
            }
        });

        // 1. View Mode toggle with 'v' key (only active if cinematic is done)
        const canControl = !this.cinematicIntro && !this.isTransitioning;
        if (canControl && keys['v'] && !this.vKeyPressed) {
            this.viewMode = this.viewMode === 'firstperson' ? 'thirdperson' : 'firstperson';
            this.setHeadVisibility(this.viewMode === 'thirdperson');
            this.vKeyPressed = true;
        }
        if (!keys['v']) {
            this.vKeyPressed = false;
        }

        // Skeletal animations update
        if (this.mixer) {
            this.mixer.update(dt);
        }

        // Horizontal rotation quaternion
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

        // Direction vectors (Locked if cinematic is playing)
        let moveDir = new THREE.Vector3(0, 0, 0);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQuat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQuat);

        if (canControl) {
            if (keys['w']) moveDir.add(forward);
            if (keys['s']) moveDir.addScaledVector(forward, -1);
            if (keys['d']) moveDir.add(right);
            if (keys['a']) moveDir.addScaledVector(right, -1);
        }

        const moving = moveDir.lengthSq() > 0.001;
        if (moving) {
            moveDir.normalize();
        }

        const running = canControl && keys['shift'];
        const currentSpeed = running ? this.runSpeed : this.walkSpeed;

        if (moving) {
            const targetVel = new THREE.Vector3().copy(moveDir).multiplyScalar(currentSpeed);
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVel.x, this.damping * dt);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVel.z, this.damping * dt);
        } else {
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, this.damping * dt);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, this.damping * dt);
        }

        if (!this.isTransitioning) {
            // Jumping logic (Locked if cinematic is playing)
            if (canControl && keys[' '] && !this.isJumping && this.position.y <= floorHeight + 0.05) {
                this.velocity.y = this.jumpVelocity;
                this.isJumping = true;
                this.playAnimation('jump_start');
            }

            // If player walked off the edge of an obstacle, start falling
            if (!this.isJumping && this.position.y > floorHeight) {
                this.isJumping = true;
                this.velocity.y = 0;
            }

            if (this.isJumping) {
                this.velocity.y -= 25.0 * dt; // Gravity acceleration
                this.position.y += this.velocity.y * dt;
                
                if (this.position.y <= floorHeight) {
                    this.position.y = floorHeight;
                    this.velocity.y = 0;
                    this.isJumping = false;
                    this.idleTimer = 0;
                    
                    if (moving) {
                        this.playAnimation(running ? 'run' : 'walk');
                    } else {
                        this.playAnimation('idle');
                    }
                } else {
                    if (this.velocity.y < 3.0) {
                        this.playAnimation('jump_loop');
                    }
                }
            } else {
                if (moving) {
                    this.idleTimer = 0;
                    this.playAnimation(running ? 'run' : 'walk');
                } else {
                    // Smoothly cycle through idle variations when standing still
                    this.idleTimer += dt;
                    if (this.idleTimer >= this.nextIdleTime) {
                        this.idleTimer = 0;
                        this.nextIdleTime = 6.0 + Math.random() * 6.0; // Randomize next idle duration (6-12 seconds)
                        
                        const idles = ['idle', 'Idle 2', 'Idle 3'];
                        let nextIdle = idles[Math.floor(Math.random() * idles.length)];
                        if (nextIdle === this.currentActionName) {
                            nextIdle = idles.find(id => id !== this.currentActionName) || 'idle';
                        }
                        this.playAnimation(nextIdle);
                    } else {
                        // Ensure we are playing one of our idle variations
                        const idles = ['idle', 'Idle 2', 'Idle 3'];
                        if (!idles.includes(this.currentActionName)) {
                            this.playAnimation('idle');
                        }
                    }
                }
            }

            // Apply velocities & boundary clamps
            let nextX = this.position.x + this.velocity.x * dt;
            let nextY = this.position.y;
            let nextZ = this.position.z + this.velocity.z * dt;

            const pRadius = 0.35; // Player collision radius thickness

            this.obstacles.forEach(obs => {
                // Expand obstacle bounds by player collision thickness
                const minX = obs.minX - pRadius;
                const maxX = obs.maxX + pRadius;
                const minZ = obs.minZ - pRadius;
                const maxZ = obs.maxZ + pRadius;

                // Only perform horizontal collision response if the player's feet are below the top of the obstacle
                if (this.position.y < obs.maxY - 0.05) {
                    if (nextX > minX && nextX < maxX && nextZ > minZ && nextZ < maxZ) {
                        // Determine penetration depth on both axes to resolve pushing out smoothly
                        const overlapX = Math.min(maxX - nextX, nextX - minX);
                        const overlapZ = Math.min(maxZ - nextZ, nextZ - minZ);

                        if (overlapX < overlapZ) {
                            if (nextX - obs.minX < obs.maxX - nextX) {
                                nextX = minX;
                            } else {
                                nextX = maxX;
                            }
                            this.velocity.x = 0;
                        } else {
                            if (nextZ - obs.minZ < obs.maxZ - nextZ) {
                                nextZ = minZ;
                            } else {
                                nextZ = maxZ;
                            }
                            this.velocity.z = 0;
                        }
                    }
                }
            });

            this.position.x = nextX;
            this.position.z = nextZ;

            // Ceiling collision check to prevent jumping through/clipping the ceiling
            const playerHeight = 1.65; // Height of the character model
            const maxFeetY = this.bounds.maxY - playerHeight;
            if (this.position.y > maxFeetY) {
                this.position.y = maxFeetY;
                if (this.velocity.y > 0) {
                    this.velocity.y = 0; // Stop upward velocity immediately upon ceiling head collision
                }
            }

            // Corridor outer boundaries clamp
            this.position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.position.x));
            this.position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.position.z));
        }

        // Update mesh orientation
        if (this.characterMesh) {
            this.characterMesh.position.copy(this.position);
            
            if (!this.isTransitioning) {
                if (this.viewMode === 'firstperson') {
                    this.lastAngle = this.yaw + Math.PI;
                    this.characterMesh.rotation.y = this.lastAngle;
                    if (moving) this.headBobTimer += dt * currentSpeed * 1.5;
                    else this.headBobTimer = THREE.MathUtils.lerp(this.headBobTimer, 0, dt * 5.0);
                } else {
                    if (moving) {
                        this.lastAngle = Math.atan2(this.velocity.x, this.velocity.z);
                        this.characterMesh.rotation.y = this.lastAngle;
                        this.headBobTimer += dt * currentSpeed * 1.5;
                    } else {
                        this.characterMesh.rotation.y = this.lastAngle;
                        this.headBobTimer = THREE.MathUtils.lerp(this.headBobTimer, 0, dt * 5.0);
                    }
                }
            } else {
                // Keep facing forward (toward windshield/cockpit front) during transitions
                this.characterMesh.rotation.y = Math.PI;
            }
        }

        const bobY = Math.sin(this.headBobTimer) * 0.08;

        // Position camera relative to perspective
        const cameraQuat = new THREE.Quaternion().copy(yawQuat).multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch)
        );

        if (this.viewMode === 'firstperson') {
            const bodyForward = new THREE.Vector3(Math.sin(this.lastAngle), 0, Math.cos(this.lastAngle));
            
            const targetOffset = (this.position.y <= 0) ? 0.22 : 0.45;
            this.firstPersonOffset = THREE.MathUtils.lerp(this.firstPersonOffset, targetOffset, dt * 15);
            
            const forwardOffset = bodyForward.multiplyScalar(this.firstPersonOffset);
            
            this.camera.position.copy(this.position)
                .add(new THREE.Vector3(0, this.eyeHeight + bobY + 0.15, 0))
                .add(forwardOffset);
            
            // Ceiling containment clamp in first person (e.g. during jumps)
            this.camera.position.y = Math.min(this.bounds.maxY - 0.35, Math.max(0.2, this.camera.position.y));
            this.camera.quaternion.copy(cameraQuat);

            if (this.camera.fov !== 100 || this.camera.near !== 0.05) {
                this.camera.fov = 100;
                this.camera.near = 0.05;
                this.camera.updateProjectionMatrix();
            }
        } else {
            if (this.camera.fov !== 75 || this.camera.near !== 0.1) {
                this.camera.fov = 75;
                this.camera.near = 0.1;
                this.camera.updateProjectionMatrix();
            }

            const lookDir = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraQuat);
            // Slight over-the-shoulder shift to keep the character from blocking direct view
            const shoulderOffset = new THREE.Vector3(0.35, 0, 0).applyQuaternion(yawQuat);

            // Initialize or smoothly interpolate player's base position to smooth out physics/jumping jitter
            if (!this.smoothedPlayerPos) {
                this.smoothedPlayerPos = new THREE.Vector3().copy(this.position);
            }
            this.smoothedPlayerPos.lerp(this.position, dt * 15.0);

            // Compute camera position using smoothed player position + instant rotation vectors (removes rotation delay)
            const cameraTargetPos = new THREE.Vector3().copy(this.smoothedPlayerPos)
                .add(new THREE.Vector3(0, 1.45 + bobY, 0)) // Focus on upper torso/head level
                .add(shoulderOffset)
                .addScaledVector(lookDir, this.cameraZoom);

            // Bounds containment for camera (prevent horizontal wall clipping and ceiling clipping)
            cameraTargetPos.x = Math.max(this.bounds.minX + 0.5, Math.min(this.bounds.maxX - 0.5, cameraTargetPos.x));
            cameraTargetPos.z = Math.max(this.bounds.minZ + 0.5, Math.min(this.bounds.maxZ - 0.5, cameraTargetPos.z));
            cameraTargetPos.y = Math.max(0.2, Math.min(this.bounds.maxY - 0.35, cameraTargetPos.y));

            // Apply camera position depending on cinematic fly-in or regular tracking
            if (this.cinematicIntro) {
                this.cinematicTime += dt;
                let progress = Math.min(1.0, this.cinematicTime / this.cinematicDuration);
                // Ease In Out cubic
                let smoothProgress = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                const startPos = new THREE.Vector3(0, 1.9, 26.5); // Starts outside/at the entrance door
                this.camera.position.lerpVectors(startPos, cameraTargetPos, smoothProgress);
                
                const startRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0, 0)); // Pointing slightly down/forward
                this.camera.quaternion.slerpQuaternions(startRot, cameraQuat, smoothProgress);

                if (progress >= 1.0) {
                    this.cinematicIntro = false;
                }
            } else {
                this.camera.position.copy(cameraTargetPos);
                this.camera.quaternion.copy(cameraQuat);
            }
        }
    }
}
window.InteriorPlayer = InteriorPlayer;
