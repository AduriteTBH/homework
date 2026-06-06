import * as THREE from 'three';
import { CONTROLS } from './config.js';

export class CharacterController {
    constructor(model, animations, camera) {
        this.model = model;
        this.animations = animations;
        this.camera = camera;

        // Input state
        this.keys = { forward: false, left: false, backward: false, right: false, run: false, jump: false, crouch: false, crouchToggleHeld: false };

        // Pointer Lock Free-Cam View angles
        this.cameraYaw = 0;
        this.cameraPitch = 0.1;
        this.mouseSensitivity = 0.002;
        this.cameraDistance = 3.5; // Zoom distance

        // Physics parameters
        this.position = new THREE.Vector3().copy(model.position);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.gravity = 25.0;
        this.jumpPower = 8.5; // Reduced from 13.0 to keep jumps grounded
        this.walkSpeed = 2.4;
        this.runSpeed = 6.0;
        this.crouchSpeed = 1.2;
        this.damping = 10.0;
        this.isOnGround = true;

        this.radius = 0.35;
        this.height = 1.8;
        this.obstacles = [];

        // Animation state machine
        this.mixer = new THREE.AnimationMixer(model);
        this.actions = {};
        this.currentActionName = '';
        this.currentAction = null;
        this.lastAngle = Math.PI;
        this.smoothedPlayerPos = null;
        this.jumpTimer = 0; // Tracks the anticipation delay before physics leap

        // Smart Physics State Tracking
        this.peakY = 0;
        this.prevGroundY = 0;
        this.climbingTimer = 0;

        // Initialize actions
        Object.keys(animations).forEach((name) => {
            const clip = animations[name];
            const action = this.mixer.clipAction(clip);
            if (name === 'jump') {
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;
            } else {
                action.setLoop(THREE.LoopRepeat);
            }
            this.actions[name] = action;

            // Create a perfect crouch_idle by cloning crouch_to_stand and freezing it at the first frame!
            if (name === 'crouch_to_stand') {
                const idleClip = clip.clone();
                idleClip.name = 'crouch_idle';
                const idleAction = this.mixer.clipAction(idleClip);
                idleAction.setLoop(THREE.LoopRepeat);
                this.actions['crouch_idle'] = idleAction;
            }
        });

        // Start idle
        this.playAnimation('idle');

        this.initInput();
    }

    initInput() {
        this.keys = {
            w: false, a: false, s: false, d: false,
            space: false, shift: false, crouch: false,
            crouchToggleHeld: false
        };

        this.keydownListener = (e) => {
            let key = e.key.toLowerCase();
            if (key === 'spacebar') key = ' '; // Normalize spacebar string across browsers

            // Prevent default browser actions for game keys
            if (key === CONTROLS.crouch || key === CONTROLS.jump) e.preventDefault();

            if (key === CONTROLS.jump) this.keys.jump = true;
            else if (key === CONTROLS.run) this.keys.run = true;
            else if (key === CONTROLS.crouch) {
                if (!this.keys.crouchToggleHeld) {
                    this.keys.crouch = !this.keys.crouch; // Toggle state
                    this.keys.crouchToggleHeld = true;
                }
            }
            else if (key === CONTROLS.forward) this.keys.forward = true;
            else if (key === CONTROLS.backward) this.keys.backward = true;
            else if (key === CONTROLS.left) this.keys.left = true;
            else if (key === CONTROLS.right) this.keys.right = true;
        };

        this.keyupListener = (e) => {
            let key = e.key.toLowerCase();
            if (key === 'spacebar') key = ' ';

            if (key === CONTROLS.jump) this.keys.jump = false;
            else if (key === CONTROLS.run) this.keys.run = false;
            else if (key === CONTROLS.crouch) {
                this.keys.crouchToggleHeld = false;
            }
            else if (key === CONTROLS.forward) this.keys.forward = false;
            else if (key === CONTROLS.backward) this.keys.backward = false;
            else if (key === CONTROLS.left) this.keys.left = false;
            else if (key === CONTROLS.right) this.keys.right = false;
        };

        this.mousemoveListener = (e) => {
            if (document.pointerLockElement === document.body) {
                this.cameraYaw -= e.movementX * this.mouseSensitivity;
                this.cameraPitch -= e.movementY * this.mouseSensitivity;
                this.cameraPitch = Math.max(-Math.PI / 3.5, Math.min(Math.PI / 4, this.cameraPitch));
            }
        };

        this.wheelListener = (e) => {
            if (document.pointerLockElement === document.body) {
                this.cameraDistance += e.deltaY * 0.005;
                // Clamp zoom between tight over-shoulder and wide pulled-back view
                this.cameraDistance = Math.max(1.5, Math.min(8.0, this.cameraDistance));
            }
        };

        window.addEventListener('keydown', this.keydownListener);
        window.addEventListener('keyup', this.keyupListener);
        window.addEventListener('mousemove', this.mousemoveListener);
        window.addEventListener('wheel', this.wheelListener);
    }

    cleanup() {
        window.removeEventListener('keydown', this.keydownListener);
        window.removeEventListener('keyup', this.keyupListener);
        window.removeEventListener('mousemove', this.mousemoveListener);
        window.removeEventListener('wheel', this.wheelListener);
        if (this.mixer) this.mixer.stopAllAction();
    }

    playAnimation(name) {
        if (!this.actions || Object.keys(this.actions).length === 0) return;
        if (this.currentActionName === name) return;

        const newAction = this.actions[name];
        if (!newAction) return;

        // 1. Adjust crossfade durations based on the action
        let duration = 0.35;
        if (name === 'jump') {
            duration = 0.1; // Instant snap for jumps
        } else if (name === 'crouch_idle' || name === 'crouch_walk' || this.currentActionName === 'crouch_idle' || this.currentActionName === 'crouch_walk') {
            duration = 0.5; // Slower, smoother blend for crouch transitions
        }

        // 2. Mixamo jump animations have an extremely long anticipation squat (often ~450ms long).
        // By skipping exactly 0.45 seconds, we bypass the squat and start exactly on the "leap" frame,
        // perfectly syncing the visual animation with the instantaneous physics jump!
        let timeScale = name === 'jump' ? 1.0 : 1.0;
        let startTime = name === 'jump' ? 0.45 : 0.0;

        if (name === 'crouch_idle') {
            timeScale = 0.0; // Permanently freeze the animation
            startTime = 0.0; // Freeze at the very first frame (the squat pose)
        }

        if (this.currentAction) {
            const prevAction = this.currentAction;
            newAction.reset();
            newAction.time = startTime;
            newAction.enabled = true;
            newAction.setEffectiveTimeScale(timeScale);
            newAction.setEffectiveWeight(1);
            prevAction.crossFadeTo(newAction, duration, true);
            newAction.play();
        } else {
            newAction.reset();
            newAction.time = startTime;
            newAction.enabled = true;
            newAction.setEffectiveWeight(1);
            newAction.setEffectiveTimeScale(timeScale);
            newAction.play();
        }

        this.currentAction = newAction;
        this.currentActionName = name;

        const activeAnimBadge = document.getElementById('anim-val');
        if (activeAnimBadge) {
            activeAnimBadge.innerText = name.toUpperCase();
        }
    }

    update(deltaTime) {
        if (deltaTime <= 0) return;

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Horizontal rotation quaternion for camera
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);

        // Direction vectors relative to camera
        let moveDir = new THREE.Vector3(0, 0, 0);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQuat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQuat);

        if (this.keys.forward) moveDir.add(forward);
        if (this.keys.backward) moveDir.addScaledVector(forward, -1);
        if (this.keys.right) moveDir.add(right);
        if (this.keys.left) moveDir.addScaledVector(right, -1);

        const moving = moveDir.lengthSq() > 0.001;
        if (moving) {
            moveDir.normalize();
        }

        // 2. Physics & Velocities (H&H style smooth lerping)
        const isRunning = this.keys.run && !this.keys.crouch;
        let currentSpeed = isRunning ? this.runSpeed : this.walkSpeed;
        if (this.keys.crouch) currentSpeed = this.crouchSpeed;

        if (moving) {
            const targetVel = new THREE.Vector3().copy(moveDir).multiplyScalar(currentSpeed);
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVel.x, this.damping * deltaTime);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVel.z, this.damping * deltaTime);
        } else {
            this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, this.damping * deltaTime);
            this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, this.damping * deltaTime);
        }

        // 3. Gravity and Jumping
        if (!this.isOnGround) {
            // Variable jump height: double gravity if spacebar is released early during ascent!
            let currentGravity = this.gravity;
            if (this.velocity.y > 0 && !this.keys.jump) {
                currentGravity *= 2.0; // Pulls down harder on a short tap, but not too hard
            }
            this.velocity.y -= currentGravity * deltaTime;
            this.jumpTimer = 0;
        } else {
            this.velocity.y = 0;
            if (this.keys.jump) {
                this.velocity.y = this.jumpPower;
                this.isOnGround = false;
                this.playAnimation('jump');
            }
        }

        const deltaPos = this.velocity.clone().multiplyScalar(deltaTime);
        this.position.add(deltaPos);

        let groundY = 0;

        // Determine ground level (either 0 or the top of a box we are standing on)
        this.obstacles.forEach((obs) => {
            if (this.position.x + this.radius > obs.min.x && this.position.x - this.radius < obs.max.x &&
                this.position.z + this.radius > obs.min.z && this.position.z - this.radius < obs.max.z) {

                // Treat as ground if the obstacle is within our step height (0.35 units) 
                // or if we were previously above it
                if (this.position.y >= obs.max.y - 0.35 || (this.position.y - deltaPos.y) >= obs.max.y) {
                    if (obs.max.y > groundY) {
                        groundY = obs.max.y;
                    }
                }
            }
        });

        // --- SMART PHYSICS TRACKING ---

        // 1. Track peak air height for fall detection
        if (!this.isOnGround) {
            if (this.position.y > this.peakY) {
                this.peakY = this.position.y;
            }
        } else {
            this.peakY = this.position.y;
        }

        // ------------------------------

        if (this.position.y <= groundY) {
            this.position.y = groundY;
            this.velocity.y = 0;
            this.isOnGround = true;
        } else {
            this.isOnGround = false;
        }

        this.handleObstacleCollisions();

        // Animation updates
        if (this.isOnGround && this.jumpTimer <= 0) {
            if (this.keys.crouch) {
                if (moving) {
                    this.playAnimation('crouch_walk');
                } else {
                    this.playAnimation('crouch_idle');
                }
            } else {
                if (moving) {
                    this.playAnimation(isRunning ? 'run' : 'walk');
                } else {
                    this.playAnimation('idle');
                }
            }
        }

        // 4. Update Character Mesh rotation (Matches H&H instant velocity tracking)
        this.model.position.copy(this.position);

        if (moving) {
            this.lastAngle = Math.atan2(this.velocity.x, this.velocity.z);
            this.model.rotation.y = this.lastAngle;
        } else {
            this.model.rotation.y = this.lastAngle;
        }

        // 5. Update Camera
        const cameraQuat = new THREE.Quaternion().copy(yawQuat).multiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.cameraPitch)
        );

        if (!this.smoothedPlayerPos) {
            this.smoothedPlayerPos = new THREE.Vector3().copy(this.position);
        }
        this.smoothedPlayerPos.lerp(this.position, deltaTime * 15.0);

        const isFirstPerson = this.cameraDistance <= 0.1;

        if (isFirstPerson) {
            // First person: forehead level camera outside the body
            const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQuat);
            const eyePos = new THREE.Vector3().copy(this.smoothedPlayerPos)
                .add(new THREE.Vector3(0, this.height * 1.2, 0))
                .addScaledVector(forwardDir, 0.6);
            this.camera.position.copy(eyePos);
            this.camera.quaternion.copy(cameraQuat);

            // Dynamic FOV: NARROW when sprinting to hide body clipping
            const isRunning = this.keys.run && !this.keys.crouch;
            const targetFov = isRunning ? 55 : 75;
            if (!this.currentFov) this.currentFov = 75;
            this.currentFov += (targetFov - this.currentFov) * Math.min(deltaTime * 6, 1);
            this.camera.fov = this.currentFov;
            this.camera.updateProjectionMatrix();
        } else {
            // Third person: pull camera back behind the character
            const lookDir = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraQuat);
            const shoulderOffset = new THREE.Vector3(0.05, 0, 0).applyQuaternion(yawQuat);

            const cameraTargetPos = new THREE.Vector3().copy(this.smoothedPlayerPos)
                .add(new THREE.Vector3(0, this.height * 0.92, 0))
                .add(shoulderOffset)
                .addScaledVector(lookDir, this.cameraDistance);

            this.camera.position.copy(cameraTargetPos);
            this.camera.quaternion.copy(cameraQuat);
        }
    }

    handleObstacleCollisions() {
        const charMinX = this.position.x - this.radius;
        const charMaxX = this.position.x + this.radius;
        const charMinZ = this.position.z - this.radius;
        const charMaxZ = this.position.z + this.radius;
        const charMinY = this.position.y;
        const charMaxY = this.position.y + this.height;

        this.obstacles.forEach((obs) => {
            // Ignore X/Z wall collision if the box is within our step height! (Allows walking up stairs)
            if (charMinY >= obs.max.y - 0.35) return;

            if (charMaxX > obs.min.x && charMinX < obs.max.x &&
                charMaxZ > obs.min.z && charMinZ < obs.max.z &&
                charMaxY > obs.min.y && charMinY < obs.max.y) {

                const overlapX1 = obs.max.x - charMinX;
                const overlapX2 = charMaxX - obs.min.x;
                const overlapZ1 = obs.max.z - charMinZ;
                const overlapZ2 = charMaxZ - obs.min.z;

                const minOverlapX = Math.min(overlapX1, overlapX2);
                const minOverlapZ = Math.min(overlapZ1, overlapZ2);

                if (minOverlapX < minOverlapZ) {
                    if (overlapX1 < overlapX2) this.position.x += overlapX1;
                    else this.position.x -= overlapX2;
                    this.velocity.x = 0;
                } else {
                    if (overlapZ1 < overlapZ2) this.position.z += overlapZ1;
                    else this.position.z -= overlapZ2;
                    this.velocity.z = 0;
                }
            }
        });
    }
}
