
// This file contains shared type definitions used across the application to avoid circular dependencies.

/**
 * Represents the emotional journey of a song, mapped to its lyrical parts.
 */
export type EmotionalArc = Record<string, { emotion: string; intensity: number; }>;

/**
 * Represents the core thematic elements of a song, used for visual generation.
 */
export type ThemeCore = {
    oneSentenceSummary: string;
    keyMotifs: string[];
    colorPalette: string[];
    sonicTexture: string;
};

/**
 * Represents timing information for a single line of lyrics.
 */
export interface LyricTiming {
    text: string;
    startTime: number;
    endTime: number;
    partLabel: string;
}

/**
 * Defines the available styles for camera movement and effects in the video generation.
 */
export type CinematicDirection = 'sentient' | 'dynamic' | 'zoom' | 'pan' | 'cyberpunk';

/**
 * Defines the mode of animation for the final video.
 * 'animatic' is the storyboard preview.
 * 'unreal' is the high-fidelity cloud engine render.
 */
export type AnimationType = 'animatic' | 'unreal';

/**
 * Represents a pre-rendered audio stem (simulating a WAV file).
 */
export interface AudioStem {
    name: string;
    buffer: AudioBuffer;
    type: 'drum' | 'bass' | 'harmony' | 'melody' | 'fx';
}

/**
 * THE VOCAL FORGE SETTINGS
 * Defines the manual overrides for vocal processing.
 */
export interface VocalFXSettings {
    cybernetics: number; // 0.0 to 1.0 (Auto-Tune / Robotic intensity)
    throat: number;      // -1200 to +1200 (Formant/Pitch Shift in cents)
    voidDepth: number;   // 0.0 to 1.0 (Reverb/Space mix)
    distortion: number;  // 0.0 to 1.0 (Grit)
}

/**
 * A named preset for the Vocal Forge.
 */
export interface VocalPreset {
    id: string;
    name: string;
    description: string;
    settings: VocalFXSettings;
}

/**
 * THE NEURAL CONDITIONING PARAMETERS
 * Used to "Train" the persona before generation.
 */
export interface PersonaSettings {
    // Warmablon Parameters
    logicMatrix: number; // 0 (Chaos) to 1 (Logic)
    dataCorruption: number; // 0 (Clean) to 1 (Glitch)
    
    // Liswaniso Parameters
    ancestralDepth: number; // 0 (Modern) to 1 (Ancient)
    realityDistortion: number; // 0 (Physics) to 1 (Dream)
}

/**
 * THEOLOGICAL FRAMEWORKS
 * The lens through which the AI views existence.
 */
export type TheologyType = 'none' | 'cyber_gnosis' | 'digital_animism' | 'loop_samsara' | 'void_nihilism';
