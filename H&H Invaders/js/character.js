import { CharacterLoader } from './loader.js';
import { CharacterController } from './controller.js';
import { CONTROLS } from './config.js';

/**
 * H&H Invaders - Interior Character Controller
 * Completely rewritten to natively wrap the Universal Character Kit!
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

        // View configuration
        this.viewMode = 'thirdperson';
        this.isTransitioning = false;

        // Rigged character assets (Universal Character Kit)
        this.charLoader = null;
        this.kitController = null;
        this.characterMesh = null;

        // Collision boundaries for ship interior decorations with heights (maxY)
        this.obstacles = [
            // Left Wall static segments
            { minX: -6.5, maxX: -3.8, minZ: -38.0, maxZ: -2.0, maxY: 3.5 },
            { minX: -6.5, maxX: -3.8, minZ: 6.0, maxZ: 25.0, maxY: 3.5 },

            // Right Wall static segments
            { minX: 3.8, maxX: 6.5, minZ: -38.0, maxZ: -16.0, maxY: 3.5 },
            { minX: 3.8, maxX: 6.5, minZ: -8.0, maxZ: 25.0, maxY: 3.5 },

            // Main Ship Rear Wall
            { minX: -8.0, maxX: 8.0, minZ: 25.0, maxZ: 26.0, maxY: 3.5 },
            
            // Engineering Alcove Back Wall
            { minX: -7.5, maxX: -6.5, minZ: -2.0, maxZ: 6.0, maxY: 3.5 },
            
            // Bunk Alcove Back Wall
            { minX: 6.5, maxX: 7.5, minZ: -16.0, maxZ: -8.0, maxY: 3.5 },

            // Engineering Alcove Side Wall 1 & 2
            { minX: -6.5, maxX: -4.0, minZ: -2.1, maxZ: -1.9, maxY: 3.5 },
            { minX: -6.5, maxX: -4.0, minZ: 5.9, maxZ: 6.1, maxY: 3.5 },

            // Bunk Alcove Side Wall 1 & 2
            { minX: 4.0, maxX: 6.5, minZ: -16.1, maxZ: -15.9, maxY: 3.5 },
            { minX: 4.0, maxX: 6.5, minZ: -8.1, maxZ: -7.9, maxY: 3.5 },

            // Engineering Reactor Core
            { minX: -6.0, maxX: -4.8, minZ: 0.5, maxZ: 3.5, maxY: 3.5 },

            // Double Bunk Bed
            { minX: 4.5, maxX: 6.2, minZ: -15.0, maxZ: -9.0, maxY: 2.0 },

            // Cargo crates and cabinets
            { minX: -3.5, maxX: -2.2, minZ: 8.0, maxZ: 10.0, maxY: 1.75 },
            { minX: 2.2, maxX: 3.5, minZ: -6.0, maxZ: -4.0, maxY: 1.0 },
            { minX: -3.8, maxX: -3.2, minZ: -20.0, maxZ: -18.0, maxY: 1.8 },
            
            // Cockpit chairs
            { minX: 1.3, maxX: 2.7, minZ: -32.8, maxZ: -31.2, maxY: 0.8 },
            { minX: -0.7, maxX: 0.7, minZ: -32.6, maxZ: -31.0, maxY: 1.5 },

            // Massive Dashboard / Front Console block
            { minX: -8.0, maxX: 8.0, minZ: -42.0, maxZ: -33.5, maxY: 3.5 }
        ];

        this.active = false;
        
        // Debug mode
        this.debugMode = false;
        this.debugHelper = null;
        this.debugUI = null;
        
        // Listen for keys to toggle views and debug
        window.addEventListener('keydown', (e) => {
            if (this.active && !this.isTransitioning) {
                if (e.key.toLowerCase() === 'v') {
                    this.viewMode = this.viewMode === 'thirdperson' ? 'firstperson' : 'thirdperson';
                    this.setHeadVisibility(this.viewMode === 'thirdperson');
                    if (this.kitController) {
                        if (this.viewMode === 'firstperson') {
                            this.kitController.cameraDistance = 0.05; // Lock camera inside head
                        } else {
                            this.kitController.cameraDistance = 3.5; // Back to standard 3rd person
                        }
                    }
                }
                if (e.key.toLowerCase() === 'x') {
                    this.toggleDebug();
                }
            }
        });
    }

    toggleDebug() {
        this.debugMode = !this.debugMode;
        if (this.debugMode) {
            console.log("Debug Mode Enabled");
            if (this.characterMesh) {
                this.debugHelper = new THREE.BoxHelper(this.characterMesh, 0x00ff00);
                this.scene.add(this.debugHelper);
            }
            
            this.debugUI = document.createElement('div');
            this.debugUI.style.position = 'fixed';
            this.debugUI.style.top = '10px';
            this.debugUI.style.left = '10px';
            this.debugUI.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            this.debugUI.style.color = '#00ff00';
            this.debugUI.style.padding = '15px';
            this.debugUI.style.fontFamily = 'monospace';
            this.debugUI.style.fontSize = '14px';
            this.debugUI.style.zIndex = '9999';
            this.debugUI.style.pointerEvents = 'none';
            this.debugUI.style.borderRadius = '8px';
            document.body.appendChild(this.debugUI);
        } else {
            console.log("Debug Mode Disabled");
            if (this.debugHelper) {
                this.scene.remove(this.debugHelper);
                this.debugHelper = null;
            }
            if (this.debugUI) {
                this.debugUI.remove();
                this.debugUI = null;
            }
        }
    }

    // === BACKWARDS COMPATIBILITY FOR INTERIOR.JS ===
    get yaw() { return this.kitController ? this.kitController.cameraYaw : 0; }
    set yaw(val) { if (this.kitController) this.kitController.cameraYaw = val; }

    get pitch() { return this.kitController ? this.kitController.cameraPitch : 0.1; }
    set pitch(val) { if (this.kitController) this.kitController.cameraPitch = val; }

    get cameraZoom() { return this.kitController ? this.kitController.cameraDistance : 2.8; }
    set cameraZoom(val) { if (this.kitController) this.kitController.cameraDistance = val; }

    get velocity() { return this.kitController ? this.kitController.velocity : new THREE.Vector3(); }
    set velocity(val) { if (this.kitController) this.kitController.velocity = val; }

    get isJumping() { return this.kitController ? !this.kitController.isOnGround : false; }
    set isJumping(val) { } // Ignore overrides from interior.js

    get mixer() { return this.kitController ? this.kitController.mixer : null; }

    playAnimation(name) {
        if (this.kitController) {
            // Forward animation requests to the kit controller
            // Map legacy H&H sit animations to the kit's idle if missing
            if (name === 'idle_to_sit' || name === 'sit_idle') name = 'idle';
            this.kitController.playAnimation(name);
        }
    }
    // ===============================================

    reset(fromSeat = false) {
        if (fromSeat) {
            const startPos = new THREE.Vector3().copy(this.seatPosition);
            const endPos = new THREE.Vector3(0, 0.0, -30.6);

            this.position.copy(startPos);
            this.viewMode = 'thirdperson';
            this.isTransitioning = true;
            
            this.loadCharacterModel();

            // Smoothly animate transition position from seat to behind seat
            let elapsed = 0;
            const duration = 1600;
            const startTime = performance.now();

            const animateStanding = () => {
                const now = performance.now();
                elapsed = now - startTime;
                const t = Math.min(1.0, elapsed / duration);

                const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                this.position.lerpVectors(startPos, endPos, easeT);
                if (this.kitController) {
                    this.kitController.position.copy(this.position);
                }

                if (t < 1.0) {
                    requestAnimationFrame(animateStanding);
                } else {
                    this.position.copy(endPos);
                    if (this.kitController) {
                        this.kitController.position.copy(this.position);
                        this.kitController.cameraYaw = Math.PI; // Face down the corridor
                    }
                    this.isTransitioning = false;
                }
            };

            animateStanding();
        } else {
            this.position.set(0, 0, 20);
            this.viewMode = 'thirdperson';
            this.isTransitioning = false;
            
            this.loadCharacterModel();
        }
    }

    setHeadVisibility(visible) {
        if (!this.characterMesh) return;
        this.characterMesh.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                // Hide actual mesh geometry for head/hair/face parts in first person
                if (name.includes('head') || name.includes('hair') || name.includes('face') ||
                    name.includes('eye') || name.includes('jaw') || name.includes('teeth') ||
                    name.includes('tongue') || name.includes('ear')) {
                    child.visible = visible;
                }
            }
            if (child.isBone) {
                const name = child.name.toLowerCase();
                if (name.includes('head') || name.includes('hair') || name.includes('face') || name.includes('eye') || name.includes('jaw')) {
                    child.scale.set(visible ? 1 : 0.001, visible ? 1 : 0.001, visible ? 1 : 0.001);
                }
            }
        });
    }

    loadCharacterModel() {
        if (this.kitController || this.charLoader) return;

        this.charLoader = new CharacterLoader();
        
        this.charLoader.loadCharacter(() => {}).then((result) => {
            this.characterMesh = result.model;
            this.characterMesh.position.copy(this.position);
            this.characterMesh.rotation.set(0, Math.PI, 0);
            
            // Normalize size perfectly using the kit logic!
            this.charLoader.normalizeHeight(this.characterMesh, this.charLoader.config.scaleHeight);
            
            // Add cinematic lighting
            const keyLight = new THREE.PointLight(0xffeedd, 1.1, 6);
            keyLight.position.set(1.5, 1.5, 1.5);
            this.characterMesh.add(keyLight);

            const fillLight = new THREE.PointLight(0x00f3ff, 0.7, 6);
            fillLight.position.set(-1.5, 1.0, 1.5);
            this.characterMesh.add(fillLight);

            const rimLight = new THREE.PointLight(0xff6600, 1.6, 6);
            rimLight.position.set(0, 1.5, -2.0);
            this.characterMesh.add(rimLight);
            
            this.scene.add(this.characterMesh);
            this.setHeadVisibility(this.viewMode === 'thirdperson');

            // Now load animations and mount the Kit Controller natively
            this.charLoader.loadAnimations(() => {}).then(animations => {
                this.kitController = new CharacterController(this.characterMesh, animations, this.camera);
                
                // Mount our custom obstacles into the kit!
                // We must map them from H&H {minX, maxX} format to the {min: {x,z}, max: {x,y,z}} format expected by the kit
                this.kitController.obstacles = this.obstacles.map(obs => ({
                    min: { x: obs.minX, y: 0, z: obs.minZ },
                    max: { x: obs.maxX, z: obs.maxZ, y: obs.maxY }
                }));
                
                // Force sync position
                this.kitController.position.copy(this.position);
                this.kitController.cameraYaw = Math.PI; // Face corridor

                // Apply head visibility AFTER animations are loaded and kit is mounted
                this.setHeadVisibility(this.viewMode === 'thirdperson');
                // Debug: log all mesh names so we can see what the FBX parts are called
                this.characterMesh.traverse((child) => {
                    if (child.isMesh) console.log('[MeshName]', child.name);
                });
                
                console.log("Universal Character Kit natively mounted and taking full control!");
            });
        }).catch(err => {
            console.warn("Character Kit load failed, spawning fallback.", err);
            this.createCharacterPlaceholder(this.position);
        });
    }

    createCharacterPlaceholder(position) {
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xe11d48, shininess: 10 });
        const skinMat = new THREE.MeshPhongMaterial({ color: 0xffedd5, emissive: 0x150805, shininess: 5 });

        const characterGroup = new THREE.Group();

        const keyLight = new THREE.PointLight(0xffeedd, 1.2, 5);
        keyLight.position.set(1.5, 1.5, 1.5);
        characterGroup.add(keyLight);

        const fillLight = new THREE.PointLight(0x00f3ff, 0.8, 5);
        fillLight.position.set(-1.5, 1.0, 1.5);
        characterGroup.add(fillLight);

        const rimLight = new THREE.PointLight(0xff6600, 2.0, 5);
        rimLight.position.set(0, 1.5, -2.0);
        characterGroup.add(rimLight);

        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.9, 8), bodyMat);
        torso.position.y = 0.45;
        characterGroup.add(torso);

        const headGeom = new THREE.SphereGeometry(0.25, 16, 16);
        const headMesh = new THREE.Mesh(headGeom, skinMat);
        headMesh.position.y = 1.1;
        characterGroup.add(headMesh);

        characterGroup.position.copy(position);
        this.scene.add(characterGroup);
        this.characterMesh = characterGroup;
    }

    update(dt, keys) {
        if (!this.active) return;

        if (this.isTransitioning) {
            // Camera tracking while character is getting up
            const targetPos = new THREE.Vector3(this.position.x, this.position.y + 1.45, this.position.z);
            this.camera.position.lerp(targetPos, dt * 10);
            return;
        }

        // Delegate entire physics, animation, collision, and camera logic directly to the Kit!
        if (this.kitController) {
            this.kitController.update(dt);
            this.position.copy(this.kitController.position);
            
            if (this.debugMode) {
                if (this.debugHelper) this.debugHelper.update();
                if (this.debugUI) {
                    this.debugUI.innerHTML = `
                        <strong>CHARACTER DEBUG</strong><br><br>
                        <strong>POS:</strong> x=${this.position.x.toFixed(2)}, y=${this.position.y.toFixed(2)}, z=${this.position.z.toFixed(2)}<br>
                        <strong>VEL:</strong> x=${this.velocity.x.toFixed(2)}, y=${this.velocity.y.toFixed(2)}, z=${this.velocity.z.toFixed(2)}<br>
                        <strong>STATE:</strong> ${this.kitController.isOnGround ? 'Grounded' : 'Airborne'}<br>
                        <strong>ANIM:</strong> ${this.kitController.currentActionName || 'none'}<br>
                        <strong>COLLISION:</strong> ${this.kitController.obstacles.length} zones loaded
                    `;
                }
            }
        }
    }
}

// Expose to window for backwards compatibility with interior.js and main.js
window.InteriorPlayer = InteriorPlayer;
