import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { CHARACTER_REGISTRY, ACTIVE_CHARACTER } from './config.js';

const ANIMATION_FILES = {
    'idle': 'idle.fbx',
    'walk': 'walking.fbx',
    'run': 'running.fbx',
    'jump': 'jump.fbx',
    'crouch_to_stand': 'Crouched To Standing.fbx',
    'crouch_walk': 'Crouched Walking.fbx',
    'left_strafe_walk': 'left strafe walk.fbx',
    'left_strafe': 'left strafe.fbx',
    'left_turn_inplace': 'left turn (2).fbx',
    'left_turn': 'left turn.fbx',
    'right_strafe_walk': 'right strafe walk.fbx',
    'right_strafe': 'right strafe.fbx',
    'right_turn_inplace': 'right turn (2).fbx',
    'right_turn': 'right turn.fbx'
};

export class CharacterLoader {
    constructor() {
        this.fbxLoader = new FBXLoader();
        this.textureLoader = new THREE.TextureLoader();
        this.texturesCache = {};
        this.materialsMap = {};

        // Load config
        this.config = CHARACTER_REGISTRY[ACTIVE_CHARACTER];
        this.modelPath = this.config.modelPath;
        this.texturesPath = this.config.texturesPath;
        this.animationsPath = this.config.animationsPath;
        
        // Smart Texture Builder
        this.textureMaps = {};
        if (this.config.textureMaterials && this.config.textureSuffixes) {
            Object.keys(this.config.textureMaterials).forEach(meshKey => {
                const prefix = this.config.textureMaterials[meshKey];
                this.textureMaps[meshKey] = {};
                if (this.config.textureSuffixes.color) {
                    this.textureMaps[meshKey].color = prefix + this.config.textureSuffixes.color;
                }
                if (this.config.textureSuffixes.normal) {
                    this.textureMaps[meshKey].normal = prefix + this.config.textureSuffixes.normal;
                }
                if (this.config.textureSuffixes.roughness) {
                    this.textureMaps[meshKey].roughness = prefix + this.config.textureSuffixes.roughness;
                }
                if (this.config.textureSuffixes.metallic) {
                    this.textureMaps[meshKey].metallic = prefix + this.config.textureSuffixes.metallic;
                }
            });
        } else if (this.config.textureMaps) {
            // Fallback for legacy hardcoded textureMaps
            this.textureMaps = this.config.textureMaps;
        }
    }

    loadTexture(fileName, isColorMap = true) {
        const url = `${this.texturesPath}${fileName}`;
        if (this.texturesCache[url]) {
            return this.texturesCache[url];
        }

        const texture = this.textureLoader.load(url);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        if (isColorMap) {
            texture.colorSpace = THREE.SRGBColorSpace;
        } else {
            texture.colorSpace = THREE.NoColorSpace;
        }
        
        texture.flipY = true;
        this.texturesCache[url] = texture;
        return texture;
    }

    loadCharacter(onProgress) {
        return new Promise((resolve, reject) => {
            onProgress({ status: `Loading ${this.config.name} FBX Model...`, progress: 10 });
            
            this.fbxLoader.load(this.modelPath, (fbx) => {
                onProgress({ status: 'Mapping PBR Textures...', progress: 40 });
                
                const meshParts = [];

                fbx.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        const originalMat = child.material;
                        const matName = (originalMat ? (originalMat.name || '') : '').toLowerCase();
                        const childName = (child.name || '').toLowerCase();
                        console.log(`loadCharacter Mesh Traversal - Mesh: "${child.name}", Original Material name: "${originalMat ? originalMat.name : 'none'}", matName: "${matName}"`);
                        
                        if (child.name && !meshParts.includes(child.name)) {
                            meshParts.push(child.name);
                        }

                        let configKey = null;
                        for (const key of Object.keys(this.textureMaps)) {
                            if (matName.includes(key) || childName.includes(key)) {
                                configKey = key;
                                break;
                            }
                        }
                        console.log(`  -> Matched configKey: "${configKey}"`);

                        const pbrMat = new THREE.MeshStandardMaterial({
                            name: child.name || (originalMat ? originalMat.name : 'Material') || 'Material',
                            color: new THREE.Color(0xffffff),
                            roughness: 0.6,
                            metalness: 0.1
                        });

                        child.material = pbrMat;
                        this.materialsMap[child.name || child.id] = pbrMat;

                        if (configKey && this.textureMaps[configKey]) {
                            const cfg = this.textureMaps[configKey];
                            console.log(`  -> Loading textures for "${configKey}":`, cfg);
                            if (cfg.color) {
                                pbrMat.map = this.loadTexture(cfg.color, true);
                            }
                            if (cfg.normal) {
                                pbrMat.normalMap = this.loadTexture(cfg.normal, false);
                                pbrMat.normalScale.set(1.0, 1.0);
                            }
                            if (cfg.roughness) {
                                pbrMat.roughnessMap = this.loadTexture(cfg.roughness, false);
                                pbrMat.roughness = 1.0;
                            }
                            if (cfg.metallic) {
                                pbrMat.metalnessMap = this.loadTexture(cfg.metallic, false);
                                pbrMat.metalness = 1.0;
                            }
                            if (cfg.transparent) {
                                pbrMat.transparent = true;
                                pbrMat.alphaTest = 0.5;
                                pbrMat.side = THREE.DoubleSide;
                            }
                        }
                        
                        // IMPORTANT: Prevent SkinnedMesh bounding box culling bugs
                        child.frustumCulled = false;
                    }
                });

                fbx.traverse((child) => {
                    if (child.isMesh && (child.name.toLowerCase().includes('cabello') || child.name.toLowerCase().includes('hair'))) {
                        child.material.side = THREE.DoubleSide;
                        child.material.transparent = true;
                        child.material.alphaTest = 0.5;
                    }
                });

                // Wrap in a group to allow internal foot-offset without the physics controller wiping it
                const wrapperGroup = new THREE.Group();
                wrapperGroup.add(fbx);

                resolve({ model: wrapperGroup, fbxNode: fbx, meshParts });
            }, undefined, (err) => {
                reject(err);
            });
        });
    }

    normalizeHeight(wrapperGroup, targetHeight = 1.8) {
        const fbx = wrapperGroup.children[0];
        
        // Reset transform for clean measurement
        fbx.position.set(0, 0, 0);
        fbx.rotation.set(0, 0, 0);
        fbx.scale.set(1, 1, 1);
        fbx.updateMatrixWorld(true);

        // Measure height from actual mesh geometry only
        const box = new THREE.Box3();
        box.makeEmpty();
        fbx.traverse((child) => {
            if (child.isMesh && child.geometry) {
                child.geometry.computeBoundingBox();
                const cb = child.geometry.boundingBox.clone();
                cb.applyMatrix4(child.matrixWorld);
                box.union(cb);
            }
        });
        
        const size = new THREE.Vector3();
        box.getSize(size);
        const currentHeight = size.y;
        
        if (currentHeight > 0) {
            const scaleFactor = targetHeight / currentHeight;
            fbx.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // Recompute after scaling to find foot position
            fbx.updateMatrixWorld(true);
            const scaledBox = new THREE.Box3();
            scaledBox.makeEmpty();
            fbx.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    const cb = child.geometry.boundingBox.clone();
                    cb.applyMatrix4(child.matrixWorld);
                    scaledBox.union(cb);
                }
            });

            // Pin feet to Y=0
            fbx.position.y = -scaledBox.min.y;
        }
    }

    async loadAnimations(onProgress) {
        const animations = {};
        const keys = Object.keys(ANIMATION_FILES);
        const total = keys.length;

        for (let i = 0; i < total; i++) {
            const key = keys[i];
            const fileName = ANIMATION_FILES[key];
            const percent = 40 + Math.floor((i / total) * 55);
            
            onProgress({ status: `Loading animation: ${key} (${i + 1}/${total})...`, progress: percent });

            try {
                const animFbx = await this.loadAnimFbxPromise(`${this.animationsPath}${fileName}`);
                if (animFbx.animations && animFbx.animations.length > 0) {
                    const clip = animFbx.animations[0];
                    clip.name = key; 

                    // Programmatically force 'In Place' animation by locking X and Z position tracks
                    clip.tracks.forEach(track => {
                        if (track.name.match(/hips\.position/i)) {
                            const values = track.values;
                            if (values.length >= 3) {
                                for (let j = 0; j < values.length; j += 3) {
                                    values[j] = 0;
                                    values[j + 2] = 0;
                                }
                            }
                        }
                    });

                    animations[key] = clip;
                }
            } catch (err) {
                console.error(`Failed to load animation: ${key}`, err);
            }
        }

        onProgress({ status: 'Calibration completed.', progress: 100 });
        return animations;
    }

    loadAnimFbxPromise(url) {
        return new Promise((resolve, reject) => {
            this.fbxLoader.load(url, (fbx) => {
                resolve(fbx);
            }, undefined, (err) => {
                reject(err);
            });
        });
    }

    toggleTextures(useTextures, useNormals, useRoughMetal) {
        Object.values(this.materialsMap).forEach((mat) => {
            const matName = mat.name.toLowerCase();
            let configKey = null;
            for (const key of Object.keys(this.textureMaps)) {
                if (matName.includes(key)) {
                    configKey = key;
                    break;
                }
            }

            if (!configKey || !this.textureMaps[configKey]) return;
            const cfg = this.textureMaps[configKey];

            if (useTextures && cfg.color) {
                mat.map = this.loadTexture(cfg.color, true);
            } else {
                mat.map = null;
            }

            if (useNormals && cfg.normal) {
                mat.normalMap = this.loadTexture(cfg.normal, false);
            } else {
                mat.normalMap = null;
            }

            if (useRoughMetal && cfg.roughness) {
                mat.roughnessMap = this.loadTexture(cfg.roughness, false);
                mat.roughness = 1.0;
            } else {
                mat.roughnessMap = null;
                mat.roughness = 0.6;
            }

            if (useRoughMetal && cfg.metallic) {
                mat.metalnessMap = this.loadTexture(cfg.metallic, false);
                mat.metalness = 1.0;
            } else {
                mat.metalnessMap = null;
                mat.metalness = 0.1;
            }
            mat.needsUpdate = true;
        });
    }
}
