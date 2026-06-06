// ==========================================
// 🎮 GLOBAL KEYBINDS
// ==========================================
// You can customize the controls here. The engine will read them automatically.
export const CONTROLS = {
    forward: 'w',
    backward: 's',
    left: 'a',
    right: 'd',
    jump: ' ', // Spacebar
    run: 'shift',
    crouch: 'control'
};

// ==========================================
// 🎮 CHARACTER CONFIGURATION REGISTRY
// ==========================================
export const CHARACTER_REGISTRY = {
    'ruby': {
        name: 'Ruby',
        
        // 1. Model & Folder Paths
        modelPath: 'assets/Ruby/RubyV1.fbx', // Path to the 3D model FBX
        texturesPath: 'assets/Ruby/textures/',             // Folder containing the textures
        
        // Choose between 'assets/Female Universal Animations/' or 'assets/Male Universal Animations/'
        animationsPath: 'assets/Female Universal Animations/', // Folder containing the animations
        
        // 2. Physics & Scaling
        scaleHeight: 1.8, // Automatically scales the character to be exactly 1.8 meters tall
        yOffset: -0.15, // Fine-tune vertical position to fix floating feet (Adjust this number if she floats or clips!)
        
        // 3. Smart Texture Mapping
        // Explicitly define which textures exist to prevent missing metallic maps from making everything shiny!
        textureMaps: {
            'body': { color: 'BodyColor.png', normal: 'BodyNormal.png', roughness: 'BodyRoughness.png' },
            'eye': { color: 'BodyColor.png', normal: 'BodyNormal.png', roughness: 'BodyRoughness.png' },
            'boot': { color: 'BootsColor.png', normal: 'BootsNormal.png', roughness: 'BootsRoughness.png', metallic: 'BootsMetallic.png' },
            'shirt': { color: 'ClothColor.png', normal: 'ClothNormal.png', roughness: 'ClothRoughness.png', metallic: 'ClothMetallic.png' },
            'pant': { color: 'ClothColor.png', normal: 'ClothNormal.png', roughness: 'ClothRoughness.png', metallic: 'ClothMetallic.png' },
            'belt': { color: 'ClothColor.png', normal: 'ClothNormal.png', roughness: 'ClothRoughness.png', metallic: 'ClothMetallic.png' },
            'hair': { color: 'HairColor.png', normal: 'HairNormal.png', roughness: 'HairRoughness.png', metallic: 'HairMetallic.png', transparent: true },
            'legnet': { color: 'fishnetsColor.png', transparent: true }
        }
    }
};

// ==========================================
// ACTIVE CHARACTER SELECTION
// ==========================================
// Change this to the name of the character block you want to play as (e.g. 'ruby')
export const ACTIVE_CHARACTER = 'ruby';
