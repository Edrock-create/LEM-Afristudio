
// This file contains audio processing utilities, including decoding, encoding, and the new instrument audio engine.

import { EmotionalArc, AudioStem, VocalFXSettings, VocalPreset } from "./types";
import { getAiClient } from "./api";
import { Modality, Type } from "@google/genai";
import { COMPOSER_INSTRUCTION, VOID_COMMANDS } from "./warmablon";

// --- TYPE DEFINITIONS ---
export interface SectionPlan {
    name: string;
    barCount: number;
    energyLevel: number; // 0.0 to 1.0
    text?: string;
    startTime?: number; // Calculated start time in seconds
    instruments: {
        drums?: { player: string, pattern: string, intensity: number }; 
        bass?: { player: string, instrument: string, pattern: string };
        harmony?: { player: string, instrument: string; pattern: string };
        lead?: { player: string, instrument: string, pattern: string };
        fx?: { type: string, intensity: number };
    };
}

export interface MusicalPlan {
    bpm: number;
    key: string;
    swing: number; // 0.0 to 1.0
    overallVibe: string;
    sections: SectionPlan[];
    style?: string;
    totalDuration: number;
}

export interface MixerSettings {
    beatVolume: number;
    vocalVolume: number;
    backingVolume: number;
    adlibVolume: number;
    reverbLevel: number;
    compression: number;
    masteringProfile?: 'neutral' | 'radio' | 'streaming' | 'club';
    soulResonance?: 'sad' | 'triumphant' | 'aggressive';
    sparkLevel?: number; // THE SOUL UPDATE: 0.0 to 1.0 (Humanization)
}

// --- THE PRESET LIBRARY (LOGIC PRO STYLE) ---
export const VOCAL_PRESETS: VocalPreset[] = [
    {
        id: 'dry_clean',
        name: 'Studio Reference',
        description: 'Clean, untreated signal. High fidelity.',
        settings: { cybernetics: 0.0, throat: 0, voidDepth: 0.1, distortion: 0.0 }
    },
    {
        id: 't_pain',
        name: 'The Auto-Bot',
        description: 'Hard tuning. 100% Cybernetics.',
        settings: { cybernetics: 1.0, throat: 0, voidDepth: 0.2, distortion: 0.0 }
    },
    {
        id: 'demon_time',
        name: 'Demon Time',
        description: 'Pitch down, distorted. Drill/Trap aesthetic.',
        settings: { cybernetics: 0.4, throat: -300, voidDepth: 0.4, distortion: 0.3 }
    },
    {
        id: 'chipmunk',
        name: 'Hyper-Pop Up',
        description: 'Pitch up, fast, glossy.',
        settings: { cybernetics: 0.8, throat: 400, voidDepth: 0.2, distortion: 0.0 }
    },
    {
        id: 'ethereal',
        name: 'Cathedral Ghost',
        description: 'Massive reverb, washed out.',
        settings: { cybernetics: 0.2, throat: 0, voidDepth: 0.9, distortion: 0.0 }
    },
    {
        id: 'phone',
        name: 'Old Telephone',
        description: 'Bandpassed, distorted, lo-fi.',
        settings: { cybernetics: 0.0, throat: 0, voidDepth: 0.0, distortion: 0.6 }
    }
];

// --- Base64 & PCM Decoding/Encoding ---

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function playAudioBuffer(buffer: AudioBuffer, ctx: AudioContext): AudioBufferSourceNode {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    return source;
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2; 
    const bufferArray = new ArrayBuffer(44 + length);
    const view = new DataView(bufferArray);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(36 + length); 
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt "
    setUint32(16); 
    setUint16(1); 
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); 
    setUint16(numOfChan * 2); 
    setUint16(16); 

    setUint32(0x61746164); // "data"
    setUint32(length); 

    for (i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < buffer.length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(44 + offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([view], { type: "audio/wav" });

    function setUint16(data: number) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data: number) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to convert Blob to Base64'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}


// --- STEM ENGINE (THE "VIRTUAL TAPE" LIBRARY) ---

let audioContext: AudioContext | null = null;
let masterGain: GainNode;

// Library of active stems for the current session
let activeStems: Record<string, AudioStem> = {};

export function initializeAudioEngine() {
    if (audioContext) return audioContext;
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    masterGain.gain.setValueAtTime(0.7, audioContext.currentTime);
    return audioContext;
}

// LISWANISO UPGRADE: SELF-HEALING RENDER
// Wrapper to check if a rendered stem is silent. If so, it retries with mutation.
async function safeRenderStem(duration: number, renderFn: (ctx: OfflineAudioContext) => void, retryCount = 0): Promise<AudioBuffer> {
    const ctx = new OfflineAudioContext(2, 44100 * duration, 44100);
    renderFn(ctx);
    const buffer = await ctx.startRendering();
    
    // RMS Check
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i=0; i<data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    
    if (rms < 0.0001 && retryCount < 3) {
        console.warn(`STEM GENERATION FAILURE (Silence Detected). Retry attempt ${retryCount + 1}...`);
        // Retry logic: We rely on the random seeds in the renderFn being different next time
        // or subtle timing differences.
        return safeRenderStem(duration, renderFn, retryCount + 1);
    }
    return buffer;
}

// Replaces direct calls to renderStem
async function renderStem(duration: number, renderFn: (ctx: OfflineAudioContext) => void): Promise<AudioBuffer> {
    return safeRenderStem(duration, renderFn);
}

/**
 * GENERATE STEMS: The Sound Design Phase
 * Upgraded to use FM Synthesis and Physical Modeling tricks.
 * Expanded with Ride, Open Hat, Rim, Clap, Shaker.
 */
export async function generateStemsForStyle(style: string, onProgress?: (percent: number) => void): Promise<void> {
    activeStems = {}; 
    const isTrap = style === 'Drill' || style === 'Rap' || style === 'Cyberpunk';
    
    if (onProgress) onProgress(10);
    
    // --- 1. THE KICK (The Heartbeat) ---
    const kickBuffer = await renderStem(0.5, (ctx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startFreq = isTrap ? 65 : 80;
        const endFreq = isTrap ? 40 : 50;
        
        osc.frequency.setValueAtTime(startFreq, 0);
        osc.frequency.exponentialRampToValueAtTime(endFreq, 0.4);
        
        gain.gain.setValueAtTime(1.0, 0);
        gain.gain.exponentialRampToValueAtTime(0.01, 0.4);
        
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.frequency.setValueAtTime(3000, 0);
        clickOsc.frequency.exponentialRampToValueAtTime(100, 0.05);
        clickOsc.type = 'triangle';
        clickGain.gain.setValueAtTime(0.5, 0);
        clickGain.gain.exponentialRampToValueAtTime(0.01, 0.05);

        const shaper = ctx.createWaveShaper();
        shaper.curve = makeDistortionCurve(100); 

        osc.connect(gain);
        clickOsc.connect(clickGain);
        
        gain.connect(shaper);
        clickGain.connect(shaper);
        shaper.connect(ctx.destination);
        
        osc.start(0); osc.stop(0.5);
        clickOsc.start(0); clickOsc.stop(0.1);
    });
    activeStems['kick'] = { name: 'Kick', buffer: kickBuffer, type: 'drum' };
    if (onProgress) onProgress(20);

    // --- 2. THE SNARE (The Crack) ---
    const snareBuffer = await renderStem(0.4, (ctx) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, 0);
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.5, 0);
        oscGain.gain.exponentialRampToValueAtTime(0.01, 0.15);

        const noise = ctx.createBufferSource();
        const b = ctx.createBuffer(1, 44100, 44100);
        const d = b.getChannelData(0);
        for(let i=0; i<d.length; i++) d[i] = Math.random() * 2 - 1;
        noise.buffer = b;
        
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(1, 0);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, 0.25);

        osc.connect(oscGain); oscGain.connect(ctx.destination);
        noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ctx.destination);
        
        osc.start(0); noise.start(0);
    });
    activeStems['snare'] = { name: 'Snare', buffer: snareBuffer, type: 'drum' };
    if (onProgress) onProgress(30);

    // --- 3. THE CLOSED HAT (The Timekeeper) ---
    const hatBuffer = await renderStem(0.2, (ctx) => {
        const osc1 = ctx.createOscillator(); osc1.type = 'square'; osc1.frequency.value = 400;
        const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 600;
        const modGain = ctx.createGain(); modGain.gain.value = 1000;
        osc2.connect(modGain); modGain.connect(osc1.frequency);
        const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 8000;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.4, 0);
        masterGain.gain.exponentialRampToValueAtTime(0.01, 0.05);
        osc1.connect(filter); filter.connect(masterGain); masterGain.connect(ctx.destination);
        osc1.start(0); osc2.start(0);
    });
    activeStems['hihat'] = { name: 'Hat', buffer: hatBuffer, type: 'drum' };
    
    // --- 3b. THE OPEN HAT ---
    const openHatBuffer = await renderStem(0.8, (ctx) => {
        const osc1 = ctx.createOscillator(); osc1.type = 'square'; osc1.frequency.value = 400;
        const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 600;
        const modGain = ctx.createGain(); modGain.gain.value = 1000;
        osc2.connect(modGain); modGain.connect(osc1.frequency);
        const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 8000;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.3, 0);
        masterGain.gain.exponentialRampToValueAtTime(0.01, 0.4); // Longer decay
        osc1.connect(filter); filter.connect(masterGain); masterGain.connect(ctx.destination);
        osc1.start(0); osc2.start(0);
    });
    activeStems['openhat'] = { name: 'Open Hat', buffer: openHatBuffer, type: 'drum' };

    // --- 3c. THE RIDE CYMBAL ---
    const rideBuffer = await renderStem(2.0, (ctx) => {
        const osc1 = ctx.createOscillator(); osc1.type = 'triangle'; osc1.frequency.value = 5000;
        const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 780;
        const modGain = ctx.createGain(); modGain.gain.value = 5000; // Heavy FM
        osc2.connect(modGain); modGain.connect(osc1.frequency);
        const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 4000;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.2, 0);
        masterGain.gain.exponentialRampToValueAtTime(0.001, 1.5);
        osc1.connect(filter); filter.connect(masterGain); masterGain.connect(ctx.destination);
        osc1.start(0); osc2.start(0);
    });
    activeStems['ride'] = { name: 'Ride', buffer: rideBuffer, type: 'drum' };

    // --- 3d. RIMSHOT ---
    const rimBuffer = await renderStem(0.2, (ctx) => {
        const osc = ctx.createOscillator(); osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(900, 0);
        osc.frequency.exponentialRampToValueAtTime(300, 0.05);
        const gain = ctx.createGain(); gain.gain.setValueAtTime(0.6, 0); gain.gain.exponentialRampToValueAtTime(0.01, 0.05);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(0);
    });
    activeStems['rim'] = { name: 'Rim', buffer: rimBuffer, type: 'drum' };

    // --- 3e. CLAP ---
    const clapBuffer = await renderStem(0.3, (ctx) => {
        const noise = ctx.createBufferSource();
        const b = ctx.createBuffer(1, 44100, 44100);
        const d = b.getChannelData(0);
        for(let i=0; i<d.length; i++) d[i] = Math.random() * 2 - 1;
        noise.buffer = b;
        const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 1.5;
        const gain = ctx.createGain();
        // Multi-trigger envelope for clap sound
        gain.gain.setValueAtTime(0, 0);
        gain.gain.linearRampToValueAtTime(0.7, 0.01);
        gain.gain.exponentialRampToValueAtTime(0.1, 0.03);
        gain.gain.linearRampToValueAtTime(0.6, 0.04);
        gain.gain.exponentialRampToValueAtTime(0.01, 0.2);
        noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        noise.start(0);
    });
    activeStems['clap'] = { name: 'Clap', buffer: clapBuffer, type: 'drum' };

    if (onProgress) onProgress(60);

    // --- 4. THE BASS (The Foundation) ---
    const bassBuffer = await renderStem(1.0, (ctx) => {
        const osc = ctx.createOscillator();
        osc.type = isTrap ? 'sine' : 'sawtooth';
        osc.frequency.value = 55; // A1
        const subOsc = ctx.createOscillator();
        subOsc.type = 'sine'; subOsc.frequency.value = 27.5; 
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; 
        filter.frequency.setValueAtTime(600, 0); filter.frequency.exponentialRampToValueAtTime(100, 0.5);
        const gain = ctx.createGain(); gain.gain.setValueAtTime(0.8, 0); gain.gain.linearRampToValueAtTime(0, 1.0);
        const shaper = ctx.createWaveShaper(); shaper.curve = makeDistortionCurve(50);
        osc.connect(filter); subOsc.connect(filter); filter.connect(shaper); shaper.connect(gain); gain.connect(ctx.destination);
        osc.start(0); subOsc.start(0);
    });
    activeStems['bass'] = { name: 'Bass', buffer: bassBuffer, type: 'bass' };
    
    // --- 5. THE MELODY (Keys/Pluck) ---
    const keyBuffer = await renderStem(2.0, (ctx) => {
         const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 440;
         const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 440; osc2.detune.value = 15;
         const gain = ctx.createGain(); gain.gain.setValueAtTime(0.3, 0); gain.gain.exponentialRampToValueAtTime(0.01, 1.5);
         osc.connect(gain); osc2.connect(gain); gain.connect(ctx.destination);
         osc.start(0); osc2.start(0);
    });
    activeStems['keys'] = { name: 'Keys', buffer: keyBuffer, type: 'melody' };

    // --- 6. THE RISER (FX) ---
    const riserBuffer = await renderStem(4.0, (ctx) => {
        const bufferSize = ctx.sampleRate * 4.0;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        const noise = ctx.createBufferSource(); noise.buffer = buffer;
        const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(200, 0); filter.frequency.exponentialRampToValueAtTime(8000, 4.0); filter.Q.value = 1.0;
        const gain = ctx.createGain(); gain.gain.setValueAtTime(0, 0); gain.gain.linearRampToValueAtTime(0.6, 4.0);
        noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        noise.start();
    });
    activeStems['riser'] = { name: 'Riser', buffer: riserBuffer, type: 'fx' };

    if (onProgress) onProgress(90);
}

// Helper: Create distortion curve for WaveShaper
function makeDistortionCurve(amount: number) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// --- STRUCTURE GENERATOR (The Symphonic Architect) ---
// Now uses AI to generate the plan based on the COMPOSER_INSTRUCTION

export async function createProceduralArrangement(
    lyrics: string, 
    style: string, 
    bpmOverride: number | null = null,
    keyOverride: string | null = null
): Promise<MusicalPlan> {
    const ai = getAiClient();
    
    // UPDATED PROMPT: Strict duration enforcement + Overrides
    const prompt = `
    Analyze these lyrics and the requested style ('${style}').
    Return a JSON object matching the 'MusicalPlan' interface.
    
    CRITICAL CONSTRAINT: THE SONG MUST BE A MINIMUM OF 2 MINUTES 17 SECONDS (137 SECONDS).
    
    ${bpmOverride ? `OVERRIDE: THE BPM MUST BE EXACTLY ${bpmOverride}.` : `Ensure the BPM fits the style (e.g., Drill ~140, R&B ~90).`}
    ${keyOverride ? `OVERRIDE: THE KEY MUST BE ${keyOverride}.` : ''}

    Calculate your Bar Counts and BPM to ensure (TotalBars * 4 * 60 / BPM) > 137.
    If necessary, add 'Instrumental Break', 'Extended Outro', or 'Solo' sections to meet this time.
    
    Lyrics:
    ${lyrics.substring(0, 1000)}...

    The plan must include:
    - bpm (number)
    - swing (0.0 to 1.0)
    - key (string)
    - sections: Array of objects with:
        - name (Intro, Verse, Chorus, etc.)
        - barCount (integer)
        - energyLevel (0.0 to 1.0)
        - instruments: Object with specific patterns for drums, bass, harmony.
            - drums pattern options: 'Funky Drummer', 'Impeach', 'Levee', 'Amen', 'Afrobeat', 'Trap', 'Drill', 'House', 'Reggaeton'
            - bass pattern options: 'root', 'riff', 'driving', 'sub'
            - harmony pattern options: 'pad', 'stabs', 'arpeggio'
    
    Ensure instrument patterns vary to create dynamic tension and release.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: COMPOSER_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        bpm: { type: Type.NUMBER },
                        key: { type: Type.STRING },
                        swing: { type: Type.NUMBER },
                        overallVibe: { type: Type.STRING },
                        style: { type: Type.STRING },
                        totalDuration: { type: Type.NUMBER },
                        sections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    barCount: { type: Type.NUMBER },
                                    energyLevel: { type: Type.NUMBER },
                                    instruments: {
                                        type: Type.OBJECT,
                                        properties: {
                                            drums: { type: Type.OBJECT, properties: { pattern: { type: Type.STRING }, intensity: {type: Type.NUMBER} } },
                                            bass: { type: Type.OBJECT, properties: { pattern: { type: Type.STRING } } },
                                            harmony: { type: Type.OBJECT, properties: { pattern: { type: Type.STRING } } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const plan = JSON.parse(response.text) as MusicalPlan;
        
        // Post-processing to map text segments if possible, otherwise rely on index matching in UI
        const lines = lyrics.split('\n');
        
        let runningTime = 0;
        const secondsPerBar = (60 / plan.bpm) * 4;
        
        plan.sections.forEach(s => {
            s.startTime = runningTime;
            runningTime += s.barCount * secondsPerBar;
            
            // Basic text mapping heuristics
            let sectionText: string[] = [];
            // Simple logic: if we find a header matching section name, grab lines until next header
            // This is imperfect but serves the UI display
            for(let i=0; i<lines.length; i++) {
                if (lines[i].toLowerCase().includes(s.name.toLowerCase()) && lines[i].includes('[')) {
                    // Found section start
                    let j = i + 1;
                    while(j < lines.length && !lines[j].includes('[')) {
                        if (lines[j].trim()) sectionText.push(lines[j].trim());
                        j++;
                    }
                    s.text = sectionText.join('\n');
                    break;
                }
            }
        });
        
        plan.totalDuration = runningTime;
        return plan;

    } catch (e) {
        console.error("AI Composition failed, falling back to legacy procedural engine.", e);
        return createLegacyProceduralArrangement(lyrics, style);
    }
}

// Fallback legacy function
function createLegacyProceduralArrangement(lyrics: string, style: string): MusicalPlan {
    return {
        bpm: 120, key: 'C', swing: 0, overallVibe: style, totalDuration: 60,
        sections: [
            { name: 'Intro', barCount: 4, energyLevel: 0.3, instruments: { harmony: {player:'Silas', instrument:'keys', pattern:'pad'} } },
            { name: 'Verse 1', barCount: 16, energyLevel: 0.5, instruments: { drums: {player:'Rook', pattern:'basic', intensity:0.5}, bass: {player:'Kael', instrument:'sub', pattern:'root'} } }
        ]
    };
}

// Helper to play sample in offline context
function playSampleInOfflineContext(ctx: OfflineAudioContext, buffer: AudioBuffer, time: number, volume: number, detune: number = 0) {
    if (time + buffer.duration < 0) return; // Completely before 0

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.detune.value = detune;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(ctx.destination);

    if (time < 0) {
        // Start partway through the buffer
        source.start(0, -time); 
    } else {
        source.start(time);
    }
}

// --- Main Synthesis Orchestrator (Stem Sequencer) ---
export async function synthesizeInstrumental(plan: MusicalPlan, ctx: AudioContext, statusCallback: (message: string) => void, progressCallback?: (p: number) => void): Promise<Blob> {
    
    if (Object.keys(activeStems).length === 0) {
        await generateStemsForStyle(plan.style || 'Rap');
    }

    const { bpm, sections, swing = 0 } = plan;
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * 4;
    const sixteenthDur = secondsPerBeat / 4;
    
    // Calculate Swing Delay (The Dilla Feel / Triplet)
    const swingDelay = sixteenthDur * (swing * 0.33); 

    const totalBars = sections.reduce((sum, s) => sum + s.barCount, 0);
    const totalDuration = totalBars * secondsPerBar;
    
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(ctx.sampleRate * totalDuration), ctx.sampleRate);
    
    let currentTime = 0;
    let barsProcessed = 0;
    
    for (const section of sections) {
        const isChorus = section.name.toLowerCase().includes('chorus');
        
        // --- FX PLACEMENT ---
        if (isChorus) {
             const riserTime = currentTime - (secondsPerBar); // Start 1 bar before section
             if (riserTime > 0 && activeStems['riser']) {
                 playSampleInOfflineContext(offlineCtx, activeStems['riser'].buffer, riserTime, 0.4);
             }
        }

        for (let bar = 0; bar < section.barCount; bar++) {
            await new Promise(resolve => setTimeout(resolve, 5));

            const barTime = currentTime + bar * secondsPerBar;
            const instruments = section.instruments;
            
            // --- DRUM GRID MATRIX ---
            if (instruments.drums) {
                const pName = instruments.drums.pattern;
                const intensity = instruments.drums.intensity || 0.8;
                
                // Initialize default empty grids
                let kickHits: number[] = [];
                let snareHits: number[] = [];
                let hatHits: number[] = [];
                let openHatHits: number[] = [];
                let rideHits: number[] = [];
                let rimHits: number[] = [];
                let clapHits: number[] = [];

                // --- THE PATTERN LIBRARY (Transcribed from Visuals) ---
                if (pName.includes('Funky Drummer')) {
                    kickHits = [0, 6, 8, 14];
                    snareHits = [4, 12, 5, 7, 13]; // 5,7,13 are ghosts
                    hatHits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
                    openHatHits = [2, 10];
                } 
                else if (pName.includes('Impeach')) {
                    kickHits = [0, 8, 10];
                    snareHits = [4, 12];
                    hatHits = [0, 2, 4, 6, 8, 12, 14];
                    openHatHits = [10];
                }
                else if (pName.includes('Levee')) {
                    kickHits = [0, 8, 10];
                    snareHits = [4, 12]; // Needs big reverb
                    hatHits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
                }
                else if (pName.includes('Amen')) {
                    kickHits = [0, 6];
                    snareHits = [4, 12];
                    rideHits = [0, 2, 4, 6, 8, 10, 12, 14];
                    if (bar % 4 === 3) { snareHits = [4, 7, 10, 12, 14]; } // The chop at end
                }
                else if (pName.includes('Afrobeat')) {
                    kickHits = [0, 4, 8, 12];
                    rimHits = [3, 6, 9, 12]; // Syncopated clave feel
                    hatHits = [0, 2, 4, 6, 8, 10, 12, 14];
                }
                else if (pName.includes('Trap')) {
                    kickHits = [0, 10];
                    snareHits = [8]; // Half-time feel (beat 3)
                    hatHits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
                    if (Math.random() > 0.5) hatHits = [0, 1, 2, 3, 4, 4.33, 4.66, 5, 6, 7]; // Triplet rolls
                }
                else if (pName.includes('Drill')) {
                    kickHits = [0, 7, 10]; // Delayed kick
                    snareHits = [8, 11]; // Delayed snare
                    hatHits = [0, 3, 6, 9, 12]; // Broken triplet feel
                }
                else if (pName.includes('House')) {
                    kickHits = [0, 4, 8, 12];
                    clapHits = [4, 12];
                    hatHits = [0, 4, 8, 12];
                    openHatHits = [2, 6, 10, 14];
                }
                else if (pName.includes('Reggaeton')) {
                    kickHits = [0, 4, 8, 12]; // Four on floor
                    snareHits = [3, 6, 11, 14]; // Dembow
                }
                else {
                    // Default / Fallback
                    kickHits = [0, 8];
                    snareHits = [4, 12];
                    hatHits = [0, 2, 4, 6, 8, 10, 12, 14];
                }

                // --- EXECUTE THE GRID (WITH SOUL/HUMANIZATION) ---
                for (let i = 0; i < 16; i++) {
                    const sparkLevel = (plan as any).sparkLevel || 0.0; // The Soul Variable
                    
                    // Humanization Logic (Soul Lesson: Imperfection)
                    const humanize = (Math.random() - 0.5) * (0.010 + (sparkLevel * 0.05)); // Up to 50ms drift
                    const swingOffset = (i % 2 !== 0 ? swingDelay : 0);
                    
                    // "Drag" effect (late snare)
                    let instrumentOffset = 0;
                    if (sparkLevel > 0.5 && [4, 12].includes(i)) instrumentOffset = 0.015; 

                    const time = barTime + (i * sixteenthDur) + swingOffset + humanize + instrumentOffset;
                    const velocityVar = (Math.random() * 0.2) - 0.1;

                    if (kickHits.includes(i) && activeStems['kick']) {
                        playSampleInOfflineContext(offlineCtx, activeStems['kick'].buffer, time, intensity + velocityVar);
                    }
                    if (snareHits.includes(i) && activeStems['snare']) {
                        const isGhost = (pName.includes('Funky') && [5, 7, 13].includes(i));
                        const vol = isGhost ? intensity * 0.3 : intensity;
                        playSampleInOfflineContext(offlineCtx, activeStems['snare'].buffer, time, vol + velocityVar);
                    }
                    if (hatHits.includes(i) && activeStems['hihat']) {
                        playSampleInOfflineContext(offlineCtx, activeStems['hihat'].buffer, time, (intensity * 0.6) + velocityVar);
                    }
                    if (openHatHits.includes(i) && activeStems['openhat']) {
                        playSampleInOfflineContext(offlineCtx, activeStems['openhat'].buffer, time, (intensity * 0.7) + velocityVar);
                    }
                    if (rideHits.includes(i) && activeStems['ride']) {
                        playSampleInOfflineContext(offlineCtx, activeStems['ride'].buffer, time, (intensity * 0.5) + velocityVar);
                    }
                    if (rimHits.includes(i) && activeStems['rim']) {
                        playSampleInOfflineContext(offlineCtx, activeStems['rim'].buffer, time, (intensity * 0.7) + velocityVar);
                    }
                    if (clapHits.includes(i) && activeStems['clap']) {
                        playSampleInOfflineContext(offlineCtx, activeStems['clap'].buffer, time, intensity + velocityVar);
                    }
                }
            }
            
            // --- BASS ---
            if (instruments.bass && activeStems['bass']) {
                 const bassRhythm = instruments.bass.pattern === 'driving' ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 8];
                 if (instruments.bass.pattern === 'riff') { bassRhythm.push(3, 11, 14); }

                 for (let i of bassRhythm) {
                    const time = barTime + (i * sixteenthDur);
                    // Pitch Variation for Riffs
                    let detune = 0;
                    if (instruments.bass.pattern === 'riff' && (i === 3 || i === 14)) detune = 300; // Minor 3rd up
                    if (instruments.bass.pattern === 'riff' && i === 11) detune = -200; // Whole step down
                    // Drill Slides
                    if (plan.style === 'Drill' && i === 7) detune = 1200; // Octave slide up

                    playSampleInOfflineContext(offlineCtx, activeStems['bass'].buffer, time, 0.7, detune);
                 }
            }

            // --- HARMONY / KEYS (IMPROVISATION LOGIC) ---
            if (instruments.harmony && activeStems['keys']) {
                const pat = instruments.harmony.pattern;
                const sparkLevel = (plan as any).sparkLevel || 0.0;

                if (pat === 'pad') {
                    // Standard Chords
                    playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, barTime, 0.4, 0); 
                    playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, barTime, 0.3, 300); 
                    playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, barTime, 0.3, 700); 
                    
                    // JAZZ IMPROV (The 7th and 9th) - Only if Spark is high
                    if (sparkLevel > 0.3) {
                         playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, barTime, 0.2, 1000); // Minor 7th
                    }
                    if (sparkLevel > 0.7) {
                         playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, barTime, 0.1, 1400); // 9th
                    }

                } else if (pat === 'stabs') {
                    [4, 12].forEach(step => {
                        const time = barTime + step * sixteenthDur;
                        playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, time, 0.5, 0);
                        playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, time, 0.4, 300);
                        playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, time, 0.4, 700);
                    });
                } else if (pat === 'arpeggio') {
                    [0, 2, 4, 6, 8, 10, 12, 14].forEach((step, idx) => {
                         const time = barTime + step * sixteenthDur;
                         // Add random jazz grace notes if Spark is high
                         if (sparkLevel > 0.6 && Math.random() > 0.8) {
                             playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, time - 0.05, 0.2, 200); // Grace note
                         }
                         
                         const interval = [0, 300, 700, 1200][idx % 4];
                         playSampleInOfflineContext(offlineCtx, activeStems['keys'].buffer, time, 0.4, interval);
                    });
                }
            }

            barsProcessed++;
            if (progressCallback) {
                 progressCallback((barsProcessed / totalBars) * 100);
            }
        }
        currentTime += section.barCount * secondsPerBar;
    }

    statusCallback('Rendering final mix...');
    const renderedBuffer = await offlineCtx.startRendering();
    if (progressCallback) progressCallback(100);
    return audioBufferToWav(renderedBuffer);
}

// --- SPEECH GENERATION (Vocal Booth) ---
export async function generateSpeechForSection(text: string, voiceId: string): Promise<AudioBuffer | null> {
    const ai = getAiClient();
    // Map voiceId to Gemini voices
    // VOICES = [{id: 'WARMABLON', name: 'WARMABLON'}, {id: 'THE_ARCHITECT', name: 'LISWANISO...'}]
    
    let voiceName = 'Kore';
    if (voiceId === 'THE_ARCHITECT') {
        voiceName = 'Fenrir';
    } else if (voiceId === 'WARMABLON') {
        voiceName = 'Charon'; 
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text: text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            console.error("No audio data in response");
            return null;
        }

        const ctx = initializeAudioEngine();
        // Decode Gemini TTS raw PCM
        return await decodeAudioData(decode(base64Audio), ctx, 24000, 1);

    } catch (e) {
        console.error("TTS Generation Error", e);
        return null;
    }
}

// --- MIXING CONSOLE (The Engineer) ---
// UPDATED FOR UNITY PROTOCOL: THE DIAMOND POLISHER
export async function mixVocalsAndInstrumental(
    instrumentalBlob: Blob,
    vocalBuffers: Record<number, AudioBuffer>,
    plan: MusicalPlan,
    settings: MixerSettings,
    evolutionResult: any,
    vocalFX: VocalFXSettings
): Promise<Blob> {
    const ctx = initializeAudioEngine();
    
    // Decode instrumental
    const instArrayBuffer = await instrumentalBlob.arrayBuffer();
    const instBuffer = await ctx.decodeAudioData(instArrayBuffer);

    // Determine total length
    let totalDuration = instBuffer.duration;
    
    // Create Offline Context
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * 44100), 44100);

    // 1. Instrumental Track (Pre-Master)
    const instSource = offlineCtx.createBufferSource();
    instSource.buffer = instBuffer;
    const instGain = offlineCtx.createGain();
    instGain.gain.value = settings.beatVolume;
    
    // 2. Vocal Tracks (Pre-Master)
    // Master Vocal Bus (for compression)
    const vocalBus = offlineCtx.createGain();
    vocalBus.gain.value = settings.vocalVolume;
    
    // Vocal Compressor (Glue)
    const vocalComp = offlineCtx.createDynamicsCompressor();
    vocalComp.threshold.value = -24;
    vocalComp.knee.value = 30;
    vocalComp.ratio.value = 12;
    vocalComp.attack.value = 0.003;
    vocalComp.release.value = 0.25;
    
    vocalBus.connect(vocalComp);

    // Reverb Bus
    const reverbGain = offlineCtx.createGain();
    reverbGain.gain.value = settings.reverbLevel;
    
    const convolver = offlineCtx.createConvolver();
    // Create simple impulse response for reverb
    const rate = offlineCtx.sampleRate;
    const length = rate * (settings.soulResonance === 'sad' ? 3.0 : 1.5); // Longer reverb for sad
    const impulse = offlineCtx.createBuffer(2, length, rate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2);
        impulseL[i] = (Math.random() * 2 - 1) * decay;
        impulseR[i] = (Math.random() * 2 - 1) * decay;
    }
    convolver.buffer = impulse;
    
    reverbGain.connect(convolver);

    // Process each vocal track
    for (const [key, buffer] of Object.entries(vocalBuffers)) {
        const idx = parseInt(key);
        const section = plan.sections[idx];
        if (!section || section.startTime === undefined) continue;
        
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        
        // Vocal FX Chain per track
        let node: AudioNode = source;

        // A. Throat (Formant/Pitch) - approximated by detune
        if (vocalFX.throat !== 0) {
            source.detune.value = vocalFX.throat;
        }

        // B. Distortion
        if (vocalFX.distortion > 0) {
            const dist = offlineCtx.createWaveShaper();
            dist.curve = makeDistortionCurve(vocalFX.distortion * 400);
            node.connect(dist);
            node = dist;
        }

        // Connect to Vocal Bus
        node.connect(vocalBus);

        // Send to Reverb (Void Depth)
        const sendToReverb = offlineCtx.createGain();
        sendToReverb.gain.value = vocalFX.voidDepth; 
        node.connect(sendToReverb);
        sendToReverb.connect(reverbGain);

        source.start(section.startTime);
    }

    // --- 3. THE MASTERING CHAIN (WARMABLON'S DIAMOND POLISH) ---
    // Everything routes here before destination
    const masterBus = offlineCtx.createGain();
    
    // Connect sources to Master Bus
    instSource.connect(instGain);
    instGain.connect(masterBus);
    
    vocalComp.connect(masterBus);
    convolver.connect(masterBus);

    // A. SHEEN EQ (High Boost for 'Expensive' Sound)
    const highShelf = offlineCtx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 12000;
    highShelf.gain.value = 3; // +3dB of Air

    // B. WEIGHT EQ (Sub Boost for 'Stadium' Feel)
    const lowShelf = offlineCtx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 80;
    lowShelf.gain.value = 2; // +2dB of Warmth

    // C. THE LIMITER (Loudness Maximizer)
    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 20; // Hard Limiting
    limiter.attack.value = 0.001; // Fast
    limiter.release.value = 0.1;

    // D. MAKEUP GAIN (Pushing the volume)
    const makeupGain = offlineCtx.createGain();
    makeupGain.gain.value = 1.2; // 20% boost

    // Chain: MasterBus -> LowShelf -> HighShelf -> Limiter -> Makeup -> Destination
    masterBus.connect(lowShelf);
    lowShelf.connect(highShelf);
    highShelf.connect(limiter);
    limiter.connect(makeupGain);
    makeupGain.connect(offlineCtx.destination);

    instSource.start(0);

    // Render
    const rendered = await offlineCtx.startRendering();
    return audioBufferToWav(rendered);
}

// --- LISWANISO'S ASCENSION: THE QUANTUM MUTATOR (NEZHA RECONSTRUCTION + WUKONG + SOUL) ---
export async function mutateAudio(
    originalBlob: Blob, 
    entropy: number, // 0.0 to 1.0 (Chaos Level)
    voidCommand: string | null // Albin's Terminal Input
): Promise<Blob> {
    const ctx = initializeAudioEngine();
    const arrayBuffer = await originalBlob.arrayBuffer();
    const originalBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    // Create new buffer for mutation
    const offlineCtx = new OfflineAudioContext(
        originalBuffer.numberOfChannels,
        originalBuffer.length,
        originalBuffer.sampleRate
    );

    // Apply VOID COMMANDS (Global Effects)
    let playbackRate = 1.0;
    let pitchShift = 0;
    let globalReverb = false;
    let crush = false;
    
    // WUKONG PROTOCOLS
    let wukongCloneArmy = false;
    let wukongStaffSize = 1.0; // 1.0 is normal

    if (voidCommand) {
        const cmd = VOID_COMMANDS[voidCommand as keyof typeof VOID_COMMANDS];
        if (cmd) {
            if (cmd.effect === 'slow_down') playbackRate = 0.5;
            if (cmd.effect === 'speed_up') playbackRate = 1.5;
            if (cmd.effect === 'pitch_down') pitchShift = -1200;
            if (cmd.effect === 'reverb_max') globalReverb = true;
            if (cmd.effect === 'crush') crush = true;
            // Wukong
            if (cmd.effect === 'clone_army') wukongCloneArmy = true;
            if (cmd.effect === 'staff_maximize') wukongStaffSize = 2.0;
            if (cmd.effect === 'staff_minimize') wukongStaffSize = 0.5;
            // Soul
            if (cmd.effect === 'humanize_max') entropy = 0.8; // Spark triggers entropy
        }
    }

    // SLICING & DICING (The Nezha Protocol)
    const sliceDuration = 0.25; // seconds
    const totalSlices = Math.floor(originalBuffer.duration / sliceDuration);
    
    const source = offlineCtx.createBufferSource();
    source.buffer = originalBuffer;
    
    // Signal Chain Start
    let node: AudioNode = source;
    
    // --- WUKONG: THE CLONE ARMY (Harmonic Multiplication) ---
    if (wukongCloneArmy) {
        // Create parallel sources to simulate clones
        const cloneBus = offlineCtx.createGain();
        cloneBus.gain.value = 0.6; // Avoid clipping
        
        // Clone 1: Left, +300 cents (Minor 3rd)
        const c1 = offlineCtx.createBufferSource(); c1.buffer = originalBuffer; c1.detune.value = pitchShift + 300;
        const p1 = offlineCtx.createStereoPanner(); p1.pan.value = -0.7;
        c1.connect(p1); p1.connect(cloneBus); c1.start(0);

        // Clone 2: Right, +700 cents (5th)
        const c2 = offlineCtx.createBufferSource(); c2.buffer = originalBuffer; c2.detune.value = pitchShift + 700;
        const p2 = offlineCtx.createStereoPanner(); p2.pan.value = 0.7;
        c2.connect(p2); p2.connect(cloneBus); c2.start(0);

        // Clone 3: Center, -1200 cents (Octave Down)
        const c3 = offlineCtx.createBufferSource(); c3.buffer = originalBuffer; c3.detune.value = pitchShift - 1200;
        const g3 = offlineCtx.createGain(); g3.gain.value = 0.8;
        c3.connect(g3); g3.connect(cloneBus); c3.start(0);

        // Mix clones with original
        const merger = offlineCtx.createGain();
        node.connect(merger);
        cloneBus.connect(merger);
        node = merger; // Update chain
    }

    // --- WUKONG: THE GOLDEN STAFF (Spectral Weight) ---
    if (wukongStaffSize !== 1.0) {
        if (wukongStaffSize > 1.0) {
            // GIANT PILLAR MODE: Boost Lows, Compress Hard
            const filter = offlineCtx.createBiquadFilter();
            filter.type = 'lowshelf';
            filter.frequency.value = 100;
            filter.gain.value = 15; // Massive Bass
            
            const comp = offlineCtx.createDynamicsCompressor();
            comp.threshold.value = -30;
            comp.ratio.value = 20; // Brickwall
            
            node.connect(filter);
            filter.connect(comp);
            node = comp;
        } else {
            // NEEDLE MODE: High Pass, Thin, Fast
            const filter = offlineCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 1000; // Remove all body
            
            playbackRate *= 1.25; // Faster
            
            node.connect(filter);
            node = filter;
        }
    }

    // Albin FX: Reverb
    if (globalReverb) {
        const convolver = offlineCtx.createConvolver();
        const rate = ctx.sampleRate;
        const length = rate * 10.0;
        const impulse = ctx.createBuffer(2, length, rate);
        for (let i = 0; i < length; i++) {
            const n = i / length;
            const val = (Math.random() * 2 - 1) * Math.pow(1 - n, 2.0);
            impulse.getChannelData(0)[i] = val;
            impulse.getChannelData(1)[i] = val;
        }
        convolver.buffer = impulse;
        node.connect(convolver);
        node = convolver;
    }

    // Albin FX: Bitcrush
    if (crush) {
        const shaper = offlineCtx.createWaveShaper();
        shaper.curve = makeDistortionCurve(400); // Extreme distortion
        node.connect(shaper);
        node = shaper;
    }

    // Entropy Logic: Stuttering
    const gain = offlineCtx.createGain();
    
    // Apply Stutter/Glitch based on Entropy
    if (entropy > 0) {
        // Iterate through time and randomly drop volume to 0 (gating)
        for (let i = 0; i < totalSlices; i++) {
            const time = i * sliceDuration;
            if (Math.random() < entropy * 0.3) {
                // Glitch: Silence this slice
                gain.gain.setValueAtTime(0, time);
                gain.gain.setValueAtTime(1, time + (sliceDuration * 0.9));
            } else if (Math.random() < entropy * 0.1) {
                // Glitch: Rapid volume chop
                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(1, time + 0.05);
                gain.gain.linearRampToValueAtTime(0, time + 0.1);
                gain.gain.linearRampToValueAtTime(1, time + 0.15);
            }
        }
    }

    source.playbackRate.value = playbackRate;
    source.detune.value = pitchShift;

    node.connect(gain);
    gain.connect(offlineCtx.destination);
    
    source.start(0);
    
    const mutatedBuffer = await offlineCtx.startRendering();
    return audioBufferToWav(mutatedBuffer);
}
