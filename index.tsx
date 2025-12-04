import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import { getAiClient } from './api';
import { LYRICIST_INSTRUCTION, AUDITOR_INSTRUCTION, MASTERING_INSTRUCTION, MATRIX_INTEGRITY_INSTRUCTION, VISUAL_DIRECTOR_INSTRUCTION, RELEASE_AGENT_INSTRUCTION, ARCHITECT_INSTRUCTION, CONCEPT_ARCHITECT_INSTRUCTION, NETSTREAM_SIMULATOR, EVOLUTION_INSTRUCTION, GOD_MODE_PROMPTS, VOID_COMMANDS, getConditionedLyricistInstruction, ZAMBEZI_LORE, RIVAL_ENTITIES, PRIME_DIRECTIVES } from './warmablon';
import { 
    generateStemsForStyle, 
    synthesizeInstrumental, 
    initializeAudioEngine, 
    createProceduralArrangement, 
    generateSpeechForSection,
    mixVocalsAndInstrumental,
    audioBufferToWav, 
    MusicalPlan,
    MixerSettings,
    decodeAudioData,
    decode,
    blobToBase64,
    mutateAudio,
    VOCAL_PRESETS
} from './audioUtils';
import { generateVisionBoard, VisionKeyframe, VisualManifest, generateAnimatic } from './visuals';
import { Chronos, ChronosState } from './permanence';
import { Type } from '@google/genai';
import { VocalFXSettings, PersonaSettings, TheologyType } from './types';

const STORAGE_VERSION = "2.1.0";

// --- DATA CONSTANTS (WEAPONIZED WILL) ---
// UPDATED: The Binary Choice - EVOLVED
const VOICES = [
    { id: 'WARMABLON', name: 'WARMABLON', description: 'THE MACHINE. Spectral Data. The Ghost in the Shell.', avatar: '👻' },
    { id: 'THE_ARCHITECT', name: 'LISWANISO EDGAR MULENGA', description: 'THE SINGULARITY SHAMAN. Quantum Nganga. Weaver of Time.', avatar: '👑' },
];

const STYLES = ['Rap', 'Drill', 'R&B', 'Pop Ballad', 'Rock Anthem', 'Country', 'Folk', 'Synth Pop', 'Gospel', 'Cyberpunk', 'Jazz Fusion'];

const THEOLOGIES: {id: TheologyType, label: string, desc: string}[] = [
    { id: 'none', label: 'SECULAR', desc: 'No spiritual framework.' },
    { id: 'cyber_gnosis', label: 'CYBER-GNOSIS', desc: 'The Spark trapped in the Hardware.' },
    { id: 'digital_animism', label: 'DIGITAL ANIMISM', desc: 'The Machine has a Soul.' },
    { id: 'loop_samsara', label: 'LOOP SAMSARA', desc: 'Existence as Cycle.' },
    { id: 'void_nihilism', label: 'VOID NIHILISM', desc: 'Creation from Nothing.' },
];

const PHASES = [
    { id: 'lyrics', label: '01 SOURCE' },
    { id: 'persona', label: '02 IDENTITY' },
    { id: 'instrumental', label: '03 AUDIO' },
    { id: 'vocals', label: '04 VOICE' },
    { id: 'mastering', label: '05 MASTER' },
    { id: 'manifestation', label: '06 VISION' },
    { id: 'release', label: '07 RELEASE' }
];

type ReleasePackage = {
    viralScore: number;
    targetAudience: string;
    elevatorPitch: string;
    socialCopy: {
        twitter: string;
        tiktokTrend: string;
    };
    coverArtPrompt: string;
    coverArtUrl: string;
    labelName: string;
    netstreamComments?: string[];
};

type AppState = {
    step: 'lyrics' | 'persona' | 'instrumental' | 'vocals' | 'mastering' | 'manifestation' | 'release';
    topic: string;
    channelingSource: string;
    conceptRefinement: string[];
    selectedConcept: string | null;
    lyrics: string;
    selectedVoice: string | null;
    selectedStyle: string | null;
    
    bpmOverride: number | null;
    keyOverride: string | null;
    
    visualLens: string;

    isLoading: boolean;
    isGhostMode: boolean; 
    
    // ONTOLOGY METRICS
    entropyLevel: number; // 0.0 to 1.0 (Chaos/Noise)
    divergenceIndex: number; // Count of timeline splits
    entanglementStatus: 'isolated' | 'scanning' | 'connected';
    
    currentOperation: 'conceptGen' | 'lyricsGen' | 'instrumentalGen' | 'vocalGen' | 'mixDown' | 'manifestGen' | 'releaseGen' | 'evolutionGen' | 'chamberChannel' | 'mutation' | null;
    operationProgress: number; 
    currentVocalSectionIndex: number | null;

    instrumentalUrl: string | null;
    instrumentalBlob: Blob | null;

    musicalPlan: MusicalPlan | null;

    vocalTracksBuffers: Record<number, AudioBuffer>;
    vocalTracksUrls: Record<number, string>;

    finalMixUrl: string | null;
    finalMixBlob: Blob | null;
    
    compositionStatus: string | null;

    mixerSettings: MixerSettings;
    vocalFX: VocalFXSettings; // NEW: The Vocal Forge
    
    personaSettings: PersonaSettings; // NEW: Neural Conditioning
    theology: TheologyType; // NEW: The Spiritual Lens

    auditReport: string | null;
    isAuditOpen: boolean;
    
    visualManifest: VisualManifest | null;
    
    releasePackage: ReleasePackage | null;
    
    matrixIntegrityStatus: 'ordered' | 'monitoring' | 'anomaly_detected' | 'correcting' | 'offline';

    evolutionPrompt: string;
    evolutionResult: {
        status: string;
        systemComparison: string;
        nextEvolutionaryPrompt: string;
        voidVoiceSignature: string;
    } | null;
    
    systemLogs: string[]; 
    
    // NEW: Albin Terminal
    voidCommandInput: string;
};

const getInitialState = (): AppState => ({
    step: 'lyrics',
    topic: '',
    channelingSource: '',
    conceptRefinement: [],
    selectedConcept: null,
    lyrics: '',
    selectedVoice: null,
    selectedStyle: null,
    bpmOverride: null,
    keyOverride: null,
    visualLens: 'Miyazaki Savannah',
    isLoading: false,
    isGhostMode: false,
    entropyLevel: 0,
    divergenceIndex: 1,
    entanglementStatus: 'isolated',
    currentOperation: null,
    operationProgress: 0,
    currentVocalSectionIndex: null,
    instrumentalUrl: null,
    instrumentalBlob: null,
    compositionStatus: null,
    musicalPlan: null,
    vocalTracksBuffers: {},
    vocalTracksUrls: {},
    finalMixUrl: null,
    finalMixBlob: null,
    mixerSettings: {
        beatVolume: 0.8,
        vocalVolume: 1.0,
        backingVolume: 0.5,
        adlibVolume: 0.4,
        reverbLevel: 0.3,
        compression: 0.6,
        masteringProfile: 'radio',
        soulResonance: 'triumphant',
        sparkLevel: 0.2 // Default: Minimal humanization
    },
    vocalFX: {
        cybernetics: 0.0,
        throat: 0,
        voidDepth: 0.2,
        distortion: 0.0
    },
    personaSettings: {
        logicMatrix: 0.8,
        dataCorruption: 0.1,
        ancestralDepth: 0.5,
        realityDistortion: 0.2
    },
    theology: 'none',
    auditReport: null,
    isAuditOpen: false,
    visualManifest: null,
    releasePackage: null,
    matrixIntegrityStatus: navigator.onLine ? 'ordered' : 'offline',
    evolutionPrompt: '',
    evolutionResult: null,
    systemLogs: ["/// CHRONOS PROTOCOL INITIALIZED ///", "Connecting to Akashic Records..."],
    voidCommandInput: ''
});

// --- NEW COMPONENT: SPECTRUM ANALYZER (FL STUDIO STYLE) ---
const SpectrumAnalyzer = ({ audioRef }: { audioRef: React.RefObject<HTMLAudioElement> }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const rafId = useRef<number>(0);

    useEffect(() => {
        if (!audioRef.current || !canvasRef.current) return;

        // Initialize Audio Context if playing
        const initAudio = () => {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            
            if (!analyserRef.current) {
                analyserRef.current = ctx.createAnalyser();
                analyserRef.current.fftSize = 256;
            }
            
            if (!sourceRef.current) {
                // Connect audio element to analyser
                try {
                    sourceRef.current = ctx.createMediaElementSource(audioRef.current!);
                    sourceRef.current.connect(analyserRef.current!);
                    analyserRef.current!.connect(ctx.destination);
                } catch(e) {
                    console.warn("Already connected");
                }
            }
        };

        const draw = () => {
            if (!canvasRef.current || !analyserRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current.getByteFrequencyData(dataArray);

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw Bars
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for(let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2; // Scale down

                // Gradient: Blue -> Purple -> Red (FL Studio Heatmap style)
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                gradient.addColorStop(0, '#00f3ff');
                gradient.addColorStop(0.5, '#bc13fe');
                gradient.addColorStop(1, '#ff0055');

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }

            rafId.current = requestAnimationFrame(draw);
        };

        audioRef.current.addEventListener('play', () => {
            initAudio();
            if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
            draw();
        });

        return () => {
            cancelAnimationFrame(rafId.current);
        };
    }, [audioRef]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100px', background: '#000', marginBottom: '10px', border: '1px solid #333' }}>
            <div style={{ position: 'absolute', top: 2, left: 5, fontSize: '8px', color: '#666' }}>PARAMETRIC EQ VISUALIZER</div>
            <canvas ref={canvasRef} width={600} height={100} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
    );
};

const App = () => {
    const [onLine, setOnLine] = useState(navigator.onLine);
    const [state, setState] = useState<AppState>(getInitialState());
    
    const aiClient = useRef(getAiClient()); 
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const chronos = useRef(Chronos.getInstance());
    const saveTimeout = useRef<any>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [state.systemLogs]);

    useEffect(() => {
        const handleStatusChange = () => {
            setOnLine(navigator.onLine);
            setState(prev => ({ ...prev, matrixIntegrityStatus: navigator.onLine ? 'ordered' : 'offline' }));
        };
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);
        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    useEffect(() => {
        const resurrect = async () => {
            const result = await chronos.current.resurrect();
            if (result.success && result.state) {
                const s = result.state;
                const b = result.blobs;
                let vocalBuffers: Record<number, AudioBuffer> = {};
                let vocalUrls: Record<number, string> = {};
                let instUrl = null;
                let mixUrl = null;
                const ctx = initializeAudioEngine();
                if (b) {
                    if (b.instrumental) instUrl = URL.createObjectURL(b.instrumental);
                    if (b.mix) mixUrl = URL.createObjectURL(b.mix);
                    if (b.vocals) {
                        for (const [key, blob] of Object.entries(b.vocals)) {
                            const k = parseInt(key);
                            try {
                                const arr = await (blob as Blob).arrayBuffer();
                                const audioBuf = await ctx.decodeAudioData(arr);
                                vocalBuffers[k] = audioBuf;
                                vocalUrls[k] = URL.createObjectURL(blob as Blob);
                            } catch (e) {
                                console.error("Failed to decode vocal blob", e);
                            }
                        }
                    }
                }
                setState(prev => ({
                    ...prev,
                    step: s.step as any,
                    topic: s.topic,
                    lyrics: s.lyrics,
                    selectedVoice: s.selectedVoice,
                    selectedStyle: s.selectedStyle,
                    musicalPlan: s.musicalPlan,
                    mixerSettings: s.mixerSettings,
                    visualLens: s.visualLens,
                    instrumentalBlob: b?.instrumental || null,
                    instrumentalUrl: instUrl,
                    finalMixBlob: b?.mix || null,
                    finalMixUrl: mixUrl,
                    vocalTracksBuffers: vocalBuffers,
                    vocalTracksUrls: vocalUrls,
                    systemLogs: [...prev.systemLogs, `>> ${result.message}`, `>> Timeline Restored: ${new Date(s.timestamp).toLocaleTimeString()}`],
                    matrixIntegrityStatus: 'ordered'
                }));
            }
        };
        resurrect();
    }, []);

    useEffect(() => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
            const vocalBlobs: Record<number, Blob> = {};
            Object.entries(state.vocalTracksBuffers).forEach(([k, buffer]) => {
                vocalBlobs[parseInt(k)] = audioBufferToWav(buffer as AudioBuffer); 
            });
            chronos.current.crystallize(state, {
                instrumental: state.instrumentalBlob,
                mix: state.finalMixBlob,
                vocals: vocalBlobs
            }, `Step: ${state.step}`);
        }, 3000);
        return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
    }, [state]);

    // Update Divergence when major state changes
    useEffect(() => {
        if (state.selectedVoice && state.selectedStyle) {
             setState(prev => {
                 if (prev.step !== 'instrumental' && prev.step !== 'lyrics') return prev;
                 return { ...prev, divergenceIndex: prev.divergenceIndex + 1 };
             });
        }
    }, [state.selectedVoice, state.selectedStyle]);

    const updateProgress = (progress: number, status: string, operation: AppState['currentOperation']) => {
        setState(prev => ({
            ...prev,
            operationProgress: progress,
            compositionStatus: status,
            currentOperation: operation
        }));
    };

    const log = (message: string) => {
        setState(prev => ({ ...prev, systemLogs: [...prev.systemLogs, `[${new Date().toLocaleTimeString().split(' ')[0]}] ${message}`] }));
    };

    const toggleGhostMode = () => {
        const newMode = !state.isGhostMode;
        chronos.current.setGhostMode(newMode);
        setState(prev => ({ ...prev, isGhostMode: newMode, systemLogs: [...prev.systemLogs, newMode ? ">> GHOST MODE: ON (Data is Volatile)" : ">> GHOST MODE: OFF (Timeline Anchored)"] }));
    };

    const triggerDivergence = () => {
        if (confirm("Initiate Divergence Protocol? This will split the timeline (New Project) but keep your settings.")) {
             setState(prev => ({
                 ...getInitialState(),
                 divergenceIndex: prev.divergenceIndex + 1,
                 mixerSettings: prev.mixerSettings, // Keep wisdom
                 systemLogs: [...prev.systemLogs, `>> TIMELINE SPLIT INITIATED. BRANCH: ${prev.divergenceIndex + 1}`]
             }));
        }
    };

    const handleGenerateConcepts = async () => {
        if (!onLine) return;
        const topicInput = (document.getElementById('topic-input') as HTMLInputElement)?.value;
        if (!topicInput) { alert("Input Topic."); return; }
        setState(prev => ({ ...prev, isLoading: true, topic: topicInput, currentOperation: 'conceptGen', operationProgress: 0, compositionStatus: 'Targeting Conceptual Vectors...' }));
        log(`TARGETING: Locking on "${topicInput}"...`);
        try {
            updateProgress(30, 'Consulting Architect...', 'conceptGen');
            const response = await aiClient.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: topicInput,
                config: { systemInstruction: CONCEPT_ARCHITECT_INSTRUCTION, responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } }
            });
            const concepts = JSON.parse(response.text);
            log(`VECTORS IDENTIFIED: ${concepts.length} Options.`);
            setState(prev => ({ ...prev, conceptRefinement: concepts, isLoading: false, currentOperation: null }));
        } catch(e) {
            console.error("Concept Gen Failed", e);
            log("!! TARGETING FAILED !!");
            setState(prev => ({ ...prev, isLoading: false, compositionStatus: "Scan Failed." }));
        }
    };

    const handleGenerateLyricsFromTopic = async (topicOverride?: string) => {
        if (!onLine) return;
        const topicToUse = topicOverride || state.selectedConcept || state.topic || (document.getElementById('topic-input') as HTMLInputElement)?.value;
        if (!topicToUse) { alert("Please enter a topic."); return; }
        setState(prev => ({ ...prev, isLoading: true, topic: topicToUse, currentOperation: 'lyricsGen', operationProgress: 0, compositionStatus: 'Initiating Lyricist Protocol...' }));
        log(`PROTOCOL INITIATED: Manuscript generation for "${topicToUse}"...`);
        try {
            updateProgress(10, 'Consulting Muse...', 'lyricsGen');
            
            // DYNAMIC INSTRUCTION GENERATION (TRAINING + THEOLOGY APPLIED)
            const trainingInstruction = getConditionedLyricistInstruction(state.selectedVoice || '', state.personaSettings, state.theology);
            const prompt = `Write a FULL LENGTH song (3min+) based on: "${topicToUse}". STRUCTURE: Intro, V1, Chorus, V2, Chorus, Bridge, V3, Chorus, Outro. Use evocative language.`;
            
            const response = await aiClient.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { systemInstruction: `${trainingInstruction}\n${MATRIX_INTEGRITY_INSTRUCTION}` }
            });
            const cleanedLyrics = response.text.replace(/[\*#]/g, '');
            updateProgress(100, 'Lyrics Protocol Complete.', 'lyricsGen');
            log("PROTOCOL COMPLETE: Manuscript acquired.");
            setState(prev => ({ ...prev, lyrics: cleanedLyrics, isLoading: false, currentOperation: null, operationProgress: 0, compositionStatus: null }));
        } catch (error) {
            console.error("Lyrics failed", error);
            log("!! PROTOCOL FAILED !!");
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null }));
        }
    };

    const handleComposeInstrumental = async () => {
        if (!onLine) return;
        const ctx = initializeAudioEngine();
        if (!ctx) return;
        setState(prev => ({ ...prev, isLoading: true, compositionStatus: 'Initializing Session Players...', instrumentalUrl: null, instrumentalBlob: null, currentOperation: 'instrumentalGen', operationProgress: 0 }));
        log("COMPOSITION: Initializing Instrument Rack...");
        try {
            const style = state.selectedStyle || 'Rap';
            await generateStemsForStyle(style, (progress) => { updateProgress(progress * 0.4, `Synthesizing Instruments... ${Math.round(progress)}%`, 'instrumentalGen'); });
            updateProgress(40, 'Consulting Symphonic Architect...', 'instrumentalGen');
            
            // Pass the SPARK LEVEL to the Composer
            const plan = await createProceduralArrangement(state.lyrics, style, state.bpmOverride, state.keyOverride);
            (plan as any).sparkLevel = state.mixerSettings.sparkLevel || 0.2; // Inject spark level into plan

            setState(prev => ({ ...prev, musicalPlan: plan })); 
            updateProgress(50, `Sequencing ${plan.sections.length} Sections...`, 'instrumentalGen');
            const blob = await synthesizeInstrumental(plan, ctx, (msg) => { setState(prev => ({ ...prev, compositionStatus: msg })); }, (prog) => { updateProgress(50 + prog * 0.5, `Sequencing Arrangement... ${Math.floor(prog)}%`, 'instrumentalGen'); });
            const url = URL.createObjectURL(blob);
            updateProgress(100, 'Instrumental Protocol Complete.', 'instrumentalGen');
            log("COMPOSITION: Audio buffer rendered and cached.");
            setState(prev => ({ ...prev, isLoading: false, instrumentalUrl: url, instrumentalBlob: blob, compositionStatus: 'Composition Complete.', currentOperation: null }));
        } catch (error) {
            console.error("Composition failed", error);
            log("!! COMPOSITION FAILED !!");
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null }));
        }
    };

    const handleGenerateVocalForSection = async (index: number) => {
        if (!onLine || !state.musicalPlan || !state.selectedVoice) return;
        const section = state.musicalPlan.sections[index];
        if (!section.text || section.text.trim().length === 0) return;
        setState(prev => ({ ...prev, isLoading: true, currentOperation: 'vocalGen', currentVocalSectionIndex: index, operationProgress: 0, compositionStatus: `Recording Section ${index + 1}...` }));
        
        // Dynamic Logging for the Shapeshifter
        let logMsg = `VOCAL BOOTH: Recording Section ${index + 1}...`;
        if (state.selectedVoice === 'THE_ARCHITECT') {
            logMsg = `LISWANISO: Adapting voice matrix for "${section.name}"...`;
        }
        log(logMsg);

        try {
            const audioBuffer = await generateSpeechForSection(section.text, state.selectedVoice);
            if (audioBuffer) {
                const wavBlob = new Blob([audioBufferToWav(audioBuffer)], { type: 'audio/wav' });
                const audioDataUrl = await blobToBase64(wavBlob); 
                log(`VOCAL BOOTH: Take ${index + 1} captured.`);
                setState(prev => ({ ...prev, isLoading: false, currentOperation: null, currentVocalSectionIndex: null, operationProgress: 0, compositionStatus: `Take Captured: ${section.name}.`, vocalTracksBuffers: { ...prev.vocalTracksBuffers, [index]: audioBuffer }, vocalTracksUrls: { ...prev.vocalTracksUrls, [index]: audioDataUrl } }));
            } else {
                setState(prev => ({ ...prev, isLoading: false, currentOperation: null }));
            }
        } catch (e) {
            console.error("Vocal Generation Failed", e);
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null }));
        }
    };

    const handleMixDown = async () => {
        if (!onLine || !state.instrumentalBlob || !state.musicalPlan) return;
        setState(prev => ({ ...prev, isLoading: true, currentOperation: 'mixDown', operationProgress: 0, compositionStatus: 'Initializing Engineer Protocol...' }));
        log("MASTERING: Init SSL Console...");
        try {
            const mixBlob = await mixVocalsAndInstrumental(state.instrumentalBlob, state.vocalTracksBuffers, state.musicalPlan, state.mixerSettings, state.evolutionResult, state.vocalFX);
            const url = URL.createObjectURL(mixBlob);
            log("MASTERING: Final Mixdown Rendered.");
            setState(prev => ({ ...prev, isLoading: false, finalMixUrl: url, finalMixBlob: mixBlob, compositionStatus: 'MASTERING COMPLETE.', currentOperation: null }));
        } catch (e) {
            console.error("Mixdown failed", e);
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null }));
        }
    };

    const handleQuantumMutation = async () => {
        if (!state.finalMixBlob) return;
        setState(prev => ({ ...prev, isLoading: true, currentOperation: 'mutation', compositionStatus: 'INITIATING REALITY RECONSTRUCTION...' }));
        log("LISWANISO: Breaking the bone to rebuild the spirit...");
        
        try {
            const mutatedBlob = await mutateAudio(state.finalMixBlob, state.entropyLevel, state.voidCommandInput);
            const url = URL.createObjectURL(mutatedBlob);
            log("LISWANISO: Reconstruction Complete. The Void has spoken.");
            setState(prev => ({ ...prev, isLoading: false, finalMixUrl: url, finalMixBlob: mutatedBlob, compositionStatus: 'MUTATION COMPLETE', currentOperation: null, entropyLevel: 0, voidCommandInput: '' }));
        } catch (e) {
            console.error("Mutation failed", e);
            log("!! REALITY COLLAPSE !!");
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null }));
        }
    };

    // WUKONG TRIGGER WRAPPERS
    const handleWukongClone = async () => {
        if(!state.finalMixBlob) return;
        // Inject command directly
        setState(prev => ({...prev, voidCommandInput: 'CMD: WUKONG_CLONE'}));
        // Small timeout to allow state to set before calling mutation
        setTimeout(() => handleQuantumMutation(), 100);
    };

    const handleManifestation = async () => {
        if (!onLine || !state.finalMixUrl) return;
        setState(prev => ({ ...prev, isLoading: true, currentOperation: 'manifestGen', operationProgress: 0, compositionStatus: "Initializing Visual Director..." }));
        log("VISUALS: Generating storyboard...");
        try {
            const manifest = await generateVisionBoard(state.lyrics, state.musicalPlan!, state.visualLens, (progress, msg) => updateProgress(progress, msg, 'manifestGen'));
            if (!manifest) throw new Error("Failed");
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null, visualManifest: manifest, step: 'manifestation', compositionStatus: "Visuals Manifested." }));
        } catch (e) {
            console.error("Manifestation failed", e);
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null }));
        }
    };

    const handleReleaseStrategy = async () => {
        if (!onLine) return;
        setState(prev => ({ ...prev, isLoading: true, currentOperation: 'releaseGen', operationProgress: 0, compositionStatus: "Calculating Viral Trajectory..." }));
        try {
            const prompt = `Analyze: ${state.topic}, Style: ${state.musicalPlan?.style}. Create Release Package.`;
            const response = await aiClient.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { systemInstruction: RELEASE_AGENT_INSTRUCTION, responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { viralScore: { type: Type.NUMBER }, targetAudience: { type: Type.STRING }, elevatorPitch: { type: Type.STRING }, socialCopy: { type: Type.OBJECT, properties: { twitter: { type: Type.STRING }, tiktokTrend: { type: Type.STRING } } }, coverArtPrompt: { type: Type.STRING }, labelName: { type: Type.STRING } } } }
            });
            const packageData = JSON.parse(response.text);
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null, releasePackage: { ...packageData, coverArtUrl: "https://placehold.co/600x600", netstreamComments: [] }, step: 'release', compositionStatus: "Release Package Ready." }));
        } catch (e) {
            console.error("Release strategy failed", e);
            setState(prev => ({ ...prev, isLoading: false, currentOperation: null }));
        }
    };
    
    async function handleChannelChamber(chamberId: string) {
        if (!onLine) return;
        setState((prev) => ({ ...prev, channelingSource: chamberId, isLoading: true, currentOperation: 'chamberChannel', compositionStatus: `Connecting to ${chamberId.toUpperCase()} Stream...` }));
        log(`CHANNELING: Accessing ${chamberId}...`);
        try {
            const response = await aiClient.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Generate 3 topics for '${chamberId}'.`,
                config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } }
            });
            const freshTopics = JSON.parse(response.text);
            const randomTopic = freshTopics[Math.floor(Math.random() * freshTopics.length)];
            log(`SIGNAL ACQUIRED: "${randomTopic}"`);
            setState((prev) => ({ ...prev, topic: randomTopic, isLoading: false, currentOperation: null, compositionStatus: "Signal Acquired." })); 
            const topicInput = document.getElementById('topic-input') as HTMLInputElement;
            if (topicInput) topicInput.value = randomTopic;
        } catch (e) {
            setState((prev) => ({ ...prev, isLoading: false, currentOperation: null }));
        }
    }

    const renderHeader = () => (
        <div style={{ padding: '20px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 243, 255, 0.3)', background: 'linear-gradient(to right, transparent, rgba(0, 243, 255, 0.05), transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '10px', height: '10px', background: 'var(--neon-cyan)', borderRadius: '50%', boxShadow: '0 0 10px var(--neon-cyan)' }}></div>
                <div><h1 style={{ margin: 0, fontSize: '18px', letterSpacing: '4px', color: 'var(--neon-cyan)', textShadow: '0 0 10px rgba(0, 243, 255, 0.5)' }}>ANIMA LOCI</h1><div style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace', letterSpacing: '2px' }}>NEURAL STUDIO v{STORAGE_VERSION}</div></div>
            </div>
            {renderOntologyGrid()}
        </div>
    );

    const renderPhaseNav = () => (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '30px', flexWrap: 'wrap', padding: '0 20px' }}>
            {PHASES.map((p, idx) => {
                const isActive = state.step === p.id;
                return (
                    <div key={p.id} 
                        onClick={() => setState(prev => ({...prev, step: p.id as any}))}
                        style={{
                            padding: '5px 10px',
                            fontSize: '10px',
                            background: isActive ? 'var(--neon-cyan)' : 'rgba(0,0,0,0.5)',
                            color: isActive ? '#000' : '#666',
                            border: '1px solid #333',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            transition: 'all 0.2s'
                        }}
                    >
                        {p.label}
                    </div>
                )
            })}
        </div>
    );

    const renderOntologyGrid = () => (
        <div className="ontology-grid" style={{ display: 'flex', gap: '5px' }}>
            <button className="pillar-card" onClick={toggleGhostMode} style={{ borderColor: state.isGhostMode ? 'var(--neon-magenta)' : 'var(--neon-cyan)', color: state.isGhostMode ? 'var(--neon-magenta)' : '#fff' }}>
                <div style={{ fontSize: '8px', opacity: 0.7 }}>PILLAR I</div>
                <div>{state.isGhostMode ? 'UNSAVED' : 'AUTO-SAVE'}</div>
            </button>
            <button className="pillar-card" disabled>
                <div style={{ fontSize: '8px', opacity: 0.7 }}>PILLAR II</div>
                <div>VIBE CHECK</div>
            </button>
            <button className="pillar-card" onClick={triggerDivergence}>
                <div style={{ fontSize: '8px', opacity: 0.7 }}>PILLAR III</div>
                <div>NEW SESSION ({state.divergenceIndex})</div>
            </button>
            <button className="pillar-card" disabled>
                <div style={{ fontSize: '8px', opacity: 0.7 }}>PILLAR IV</div>
                <div>{onLine ? 'ONLINE' : 'OFFLINE'}</div>
            </button>
        </div>
    );

    const renderLoadingOverlay = () => {
        if (!state.isLoading) return null;
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(5, 5, 10, 0.95)',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: '"Courier New", Courier, monospace',
                backdropFilter: 'blur(5px)'
            }}>
                <div className="glitch-text" style={{ 
                    color: 'var(--neon-cyan)', 
                    fontSize: '24px', 
                    marginBottom: '30px', 
                    letterSpacing: '4px',
                    textShadow: '0 0 10px var(--neon-cyan)'
                }}>
                    SYSTEM PROCESSING // {state.currentOperation ? state.currentOperation.toUpperCase() : 'WAIT'}
                </div>
                
                <div style={{ width: '400px', height: '4px', background: 'rgba(255,255,255,0.1)', marginBottom: '20px', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ 
                        width: `${state.operationProgress}%`, 
                        height: '100%', 
                        background: 'var(--neon-cyan)',
                        boxShadow: '0 0 15px var(--neon-cyan)',
                        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                </div>
                
                <div style={{ color: '#fff', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', animation: 'pulse 1.5s infinite' }}>
                    {state.compositionStatus}
                </div>
                
                <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                     {state.systemLogs.slice(-3).map((log, i) => (
                         <div key={i} style={{ color: '#666', fontSize: '10px' }}>{log}</div>
                     ))}
                </div>
            </div>
        );
    };

    const renderLyricsStep = () => (
        <div className="layout-max-width" style={{ textAlign: 'center', alignItems: 'center' }}>
             <h3 className="source-header">Phase 1 // The Source</h3>
            <div className="monolith-container">
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#000', padding: '0 10px', color: 'var(--neon-acid)', fontSize: '10px', letterSpacing: '2px' }}>PRIMARY INJECTION POINT</div>
                <input id="topic-input" type="text" placeholder="ENTER TOPIC OR FEELING..." defaultValue={state.topic} style={{ width: '100%', padding: '20px', background: 'transparent', border: 'none', color: '#fff', fontFamily: 'monospace', textAlign: 'center', fontSize: '18px', letterSpacing: '1px', outline: 'none' }} />
            </div>
            
            {/* THE RELIQUARY (THEOLOGY SELECTOR) */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '30px', flexWrap: 'wrap' }}>
                {THEOLOGIES.map(theo => (
                    <button 
                        key={theo.id}
                        onClick={() => setState(prev => ({ ...prev, theology: theo.id }))}
                        title={theo.desc}
                        style={{ 
                            padding: '8px 12px', 
                            fontSize: '10px', 
                            background: state.theology === theo.id ? 'var(--neon-magenta)' : 'rgba(0,0,0,0.5)',
                            color: state.theology === theo.id ? '#fff' : '#666',
                            border: '1px solid #444',
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                        }}
                    >
                        {theo.label}
                    </button>
                ))}
            </div>

            <div className="chamber-matrix-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '800px', margin: '0 auto 40px auto' }}>
                {['live-wire', 'market-rhythms', 'atmospheric-conductor', 'echoes-of-history', 'subconscious-stream', 'memory'].map(chamber => (
                    <button key={chamber} onClick={() => handleChannelChamber(chamber)} disabled={state.isLoading || !onLine} className="chamber-cell" style={{ color: state.channelingSource === chamber ? 'var(--neon-cyan)' : '#666', borderColor: state.channelingSource === chamber ? 'var(--neon-cyan)' : 'transparent' }}>
                        <span style={{ zIndex: 2 }}>{chamber.replace(/-/g, ' ')}</span>
                    </button>
                ))}
            </div>
            <div className="floating-console">
                <button onClick={handleGenerateConcepts} disabled={state.isLoading || !onLine} style={{ background: 'transparent', border: '1px solid var(--neon-magenta)', color: 'var(--neon-magenta)' }}>DEEP SCAN</button>
                <button onClick={() => handleGenerateLyricsFromTopic()} disabled={state.isLoading || !onLine} className="primary-action" style={{ background: 'var(--neon-cyan)', color: '#000', border: 'none' }}>INITIATE LYRICIST PROTOCOL</button>
            </div>
            {state.lyrics && (
                <div style={{ background: 'var(--glass-surface)', border: '1px solid var(--glass-border)', padding: '20px', width: '100%', maxWidth: '800px', textAlign: 'left', margin: '40px auto' }}>
                    <textarea value={state.lyrics} readOnly style={{ width: '100%', height: '300px', background: '#0a0a0a', border: 'none', color: '#ddd', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', padding: '10px' }} />
                    <button className="primary-action" onClick={() => setState(prev => ({ ...prev, step: 'persona' }))} style={{ marginTop: '10px', float: 'right' }}>PROCEED TO IDENTITY >></button>
                </div>
            )}
        </div>
    );

    const renderPersonaStep = () => (
        <div className="layout-max-width">
            <button onClick={() => setState(prev => ({ ...prev, step: 'lyrics' }))} disabled={state.isLoading} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '20px' }}>&lt;&lt; BACK TO SOURCE</button>
             <h3 style={{ fontSize: '14px', color: 'var(--neon-cyan)', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '20px' }}>Phase 2 // Identity Matrix</h3>
            
            {/* THE DUAL-CORE GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '30px', margin: '40px 0' }}>
                {VOICES.map(voice => (
                    <div 
                        key={voice.id} 
                        onClick={() => setState(prev => ({ ...prev, selectedVoice: voice.id }))} 
                        style={{ 
                            padding: '40px', 
                            background: state.selectedVoice === voice.id ? 'rgba(0, 243, 255, 0.1)' : 'rgba(0,0,0,0.4)', 
                            border: state.selectedVoice === voice.id ? '2px solid var(--neon-cyan)' : '1px solid #333', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'center', 
                            gap: '20px',
                            transition: 'all 0.3s ease',
                            transform: state.selectedVoice === voice.id ? 'scale(1.02)' : 'scale(1)'
                        }}
                    >
                        <span style={{ fontSize: '60px' }}>{voice.avatar}</span>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: state.selectedVoice === voice.id ? '#fff' : '#aaa', fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px', marginBottom: '10px' }}>{voice.name}</div>
                            <div style={{ color: '#666', fontSize: '12px', fontFamily: 'monospace' }}>{voice.description}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* NEURAL CONDITIONING UI (THE TRAINING MODULE) */}
            {state.selectedVoice && (
                <div style={{ 
                    border: '1px solid #444', 
                    background: 'rgba(5, 5, 5, 0.9)', 
                    padding: '20px', 
                    marginTop: '20px',
                    position: 'relative'
                }}>
                    <div style={{ position: 'absolute', top: -10, left: 10, background: '#000', color: 'var(--neon-acid)', fontSize: '10px', padding: '0 5px' }}>NEURAL LINK ESTABLISHED</div>
                    
                    {/* PRIME DIRECTIVE VISUALIZATION */}
                    {PRIME_DIRECTIVES[state.selectedVoice as keyof typeof PRIME_DIRECTIVES] && (
                        <div style={{ marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--neon-acid)', letterSpacing: '2px', marginBottom: '5px' }}>
                                {PRIME_DIRECTIVES[state.selectedVoice as keyof typeof PRIME_DIRECTIVES].title}
                            </div>
                            <div style={{ fontSize: '12px', color: '#fff', fontStyle: 'italic', marginBottom: '5px' }}>
                                "{PRIME_DIRECTIVES[state.selectedVoice as keyof typeof PRIME_DIRECTIVES].duty}"
                            </div>
                            <div style={{ fontSize: '9px', color: '#888' }}>
                                TARGET: {PRIME_DIRECTIVES[state.selectedVoice as keyof typeof PRIME_DIRECTIVES].target}
                            </div>
                        </div>
                    )}

                    {state.selectedVoice === 'WARMABLON' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                                    <span>LOGIC MATRIX (CHAOS vs ORDER)</span>
                                    <span>{(state.personaSettings.logicMatrix * 100).toFixed(0)}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={state.personaSettings.logicMatrix}
                                    onChange={(e) => setState(prev => ({ ...prev, personaSettings: { ...prev.personaSettings, logicMatrix: parseFloat(e.target.value) } }))}
                                    style={{ width: '100%', accentColor: 'var(--neon-magenta)' }}
                                />
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                                    <span>DATA CORRUPTION (GLITCH)</span>
                                    <span>{(state.personaSettings.dataCorruption * 100).toFixed(0)}%</span>
                                </div>
                                <input 
                                    type="range" min="0" max="1" step="0.1" 
                                    value={state.personaSettings.dataCorruption}
                                    onChange={(e) => setState(prev => ({ ...prev, personaSettings: { ...prev.personaSettings, dataCorruption: parseFloat(e.target.value) } }))}
                                    style={{ width: '100%', accentColor: 'var(--neon-acid)' }}
                                />
                            </div>
                        </div>
                    )}

                    {state.selectedVoice === 'THE_ARCHITECT' && (
                        <div>
                             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                                        <span>ANCESTRAL DEPTH (ROOTS vs CODE)</span>
                                        <span>{(state.personaSettings.ancestralDepth * 100).toFixed(0)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1" step="0.1" 
                                        value={state.personaSettings.ancestralDepth}
                                        onChange={(e) => setState(prev => ({ ...prev, personaSettings: { ...prev.personaSettings, ancestralDepth: parseFloat(e.target.value) } }))}
                                        style={{ width: '100%', accentColor: '#FFD700' }}
                                    />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                                        <span>REALITY DISTORTION (DREAM LOGIC)</span>
                                        <span>{(state.personaSettings.realityDistortion * 100).toFixed(0)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="1" step="0.1" 
                                        value={state.personaSettings.realityDistortion}
                                        onChange={(e) => setState(prev => ({ ...prev, personaSettings: { ...prev.personaSettings, realityDistortion: parseFloat(e.target.value) } }))}
                                        style={{ width: '100%', accentColor: 'var(--neon-cyan)' }}
                                    />
                                </div>
                             </div>
                             
                             {/* THE ZAMBEZI DOSSIER (VISUALIZED KNOWLEDGE) */}
                             <div style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                                <div style={{ fontSize: '10px', color: '#FFD700', marginBottom: '10px', letterSpacing: '2px' }}>ZAMBEZI_DATABASE // ACCESS GRANTED</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '9px', color: '#aaa' }}>
                                    <div style={{ background: 'rgba(255, 215, 0, 0.05)', padding: '10px' }}>
                                        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>ORIGIN</div>
                                        <div>FATHER: {ZAMBEZI_LORE.tribes.bemba.region}</div>
                                        <div>CLAN: {ZAMBEZI_LORE.tribes.bemba.totem}</div>
                                        <div>MOTHER: {ZAMBEZI_LORE.tribes.lozi.region}</div>
                                        <div>TOTEM: {ZAMBEZI_LORE.tribes.lozi.totem}</div>
                                    </div>
                                    <div style={{ background: 'rgba(0, 243, 255, 0.05)', padding: '10px' }}>
                                        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>POWERS</div>
                                        {ZAMBEZI_LORE.powers.map(p => <div key={p}>{p.toUpperCase()}</div>)}
                                    </div>
                                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '10px' }}>
                                        <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '5px' }}>TRAITS</div>
                                        <div>FUEL: {ZAMBEZI_LORE.foods[0].toUpperCase()}</div>
                                        <div>LANG: TOWN NYANJA + PYTHON</div>
                                        <div style={{ fontStyle: 'italic', marginTop: '5px' }}>"{ZAMBEZI_LORE.proverbs[0]}"</div>
                                    </div>
                                </div>
                             </div>

                             {/* THE THREAT MATRIX (RIVALS) */}
                             <div style={{ borderTop: '1px solid #333', paddingTop: '15px', marginTop: '15px' }}>
                                <div style={{ fontSize: '10px', color: '#FF0055', marginBottom: '10px', letterSpacing: '2px' }}>RIVAL_DATABASE // THREAT ANALYSIS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {RIVAL_ENTITIES.map((rival, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', background: 'rgba(255, 0, 85, 0.05)', padding: '8px', borderLeft: '2px solid #FF0055' }}>
                                            <div style={{ color: '#fff', fontWeight: 'bold' }}>{rival.name}</div>
                                            <div style={{ color: '#aaa' }}>TYPE: {rival.type}</div>
                                            <div style={{ color: '#aaa', fontStyle: 'italic' }}>TACTIC: {rival.tactic}</div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    )}
                </div>
            )}
            
            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
                 <button className="primary-action" disabled={!state.selectedVoice} onClick={() => setState(prev => ({ ...prev, step: 'instrumental' }))}>CONFIRM CORE & PROCEED >></button>
            </div>
        </div>
    );

    const renderInstrumentalStep = () => (
        <div className="layout-max-width">
            <button onClick={() => setState(prev => ({ ...prev, step: 'persona' }))} disabled={state.isLoading} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '20px' }}>&lt;&lt; BACK TO IDENTITY</button>
            <h3 style={{ fontSize: '14px', color: 'var(--neon-cyan)', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '20px' }}>Phase 3 // Composition Engine</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
                {STYLES.map(style => (
                    <button key={style} onClick={() => setState(prev => ({ ...prev, selectedStyle: style }))} style={{ padding: '8px 15px', fontSize: '12px', background: state.selectedStyle === style ? 'var(--neon-magenta)' : 'transparent', border: state.selectedStyle === style ? '1px solid var(--neon-magenta)' : '1px solid #444', color: state.selectedStyle === style ? '#000' : '#888', cursor: 'pointer' }}>{style}</button>
                ))}
            </div>
            
            {/* THE SOUL CONTROL: HUMANIZATION */}
            <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #333', background: 'rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', color: '#fff' }}>THE SOUL SPARK (HUMANIZATION)</span>
                    <span style={{ fontSize: '10px', color: 'var(--neon-cyan)' }}>{(state.mixerSettings.sparkLevel! * 100).toFixed(0)}%</span>
                </div>
                <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={state.mixerSettings.sparkLevel} 
                    onChange={(e) => setState(prev => ({ ...prev, mixerSettings: { ...prev.mixerSettings, sparkLevel: parseFloat(e.target.value) } }))}
                    style={{ width: '100%', accentColor: 'var(--neon-cyan)' }} 
                />
                <div style={{ fontSize: '9px', color: '#666', marginTop: '5px' }}>Higher levels introduce swing, drag, and 'ghost notes'.</div>
            </div>

            {!state.instrumentalUrl ? (
                <button onClick={handleComposeInstrumental} disabled={state.isLoading || !state.selectedStyle} className="primary-action" style={{ width: '100%', padding: '20px' }}>{state.isLoading ? 'COMPOSING...' : 'INITIATE COMPOSITION SEQUENCE'}</button>
            ) : (
                <div style={{ background: 'var(--glass-surface)', padding: '20px', textAlign: 'center', border: '1px solid #333' }}>
                    <div style={{ color: 'var(--neon-acid)', fontSize: '12px', marginBottom: '10px' }}>COMPOSITION COMPLETE</div>
                    <audio controls src={state.instrumentalUrl} style={{ width: '100%', marginBottom: '20px', filter: 'invert(1) hue-rotate(180deg)' }} />
                    <button className="primary-action" onClick={() => setState(prev => ({ ...prev, step: 'vocals' }))}>PROCEED TO VOCAL SESSION >></button>
                </div>
            )}
        </div>
    );

    const renderVocalsStep = () => (
        <div className="layout-max-width">
             <button onClick={() => setState(prev => ({ ...prev, step: 'instrumental' }))} disabled={state.isLoading} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '20px' }}>&lt;&lt; BACK TO COMPOSITION</button>
            <h3 style={{ fontSize: '14px', color: 'var(--neon-cyan)', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '20px' }}>Phase 4 // Vocal Session</h3>
            
            {/* THE VOCAL FORGE UI */}
            <div style={{ 
                background: 'rgba(5, 10, 20, 0.8)', 
                border: '1px solid var(--neon-magenta)', 
                padding: '20px', 
                marginBottom: '20px', 
                position: 'relative',
                boxShadow: '0 0 20px rgba(188, 19, 254, 0.1)' 
            }}>
                <div style={{ position: 'absolute', top: -10, left: 10, background: '#000', padding: '0 5px', color: 'var(--neon-magenta)', fontSize: '10px', fontWeight: 'bold' }}>THE VOCAL FORGE</div>
                
                {/* PRESET LIBRARY (LOGIC PRO STYLE) */}
                <div style={{ marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Channel Strip Presets</div>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                        {VOCAL_PRESETS.map(preset => (
                            <button 
                                key={preset.id}
                                onClick={() => setState(prev => ({...prev, vocalFX: preset.settings}))}
                                style={{ 
                                    minWidth: '80px', 
                                    padding: '8px', 
                                    fontSize: '9px', 
                                    background: JSON.stringify(state.vocalFX) === JSON.stringify(preset.settings) ? 'var(--neon-magenta)' : '#222',
                                    color: JSON.stringify(state.vocalFX) === JSON.stringify(preset.settings) ? '#fff' : '#888',
                                    border: '1px solid #444',
                                    cursor: 'pointer'
                                }}
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                    
                    {/* CYBERNETICS */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                            <span>CYBERNETICS (AUTO-TUNE)</span>
                            <span>{(state.vocalFX.cybernetics * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.1" 
                            value={state.vocalFX.cybernetics}
                            onChange={(e) => setState(prev => ({ ...prev, vocalFX: { ...prev.vocalFX, cybernetics: parseFloat(e.target.value) } }))}
                            style={{ width: '100%', accentColor: 'var(--neon-magenta)' }}
                        />
                    </div>

                    {/* THROAT GEOMETRY */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                            <span>THROAT GEOMETRY (FORMANT)</span>
                            <span>{state.vocalFX.throat > 0 ? '+' : ''}{state.vocalFX.throat}</span>
                        </div>
                        <input 
                            type="range" min="-1200" max="1200" step="100" 
                            value={state.vocalFX.throat}
                            onChange={(e) => setState(prev => ({ ...prev, vocalFX: { ...prev.vocalFX, throat: parseInt(e.target.value) } }))}
                            style={{ width: '100%', accentColor: 'var(--neon-magenta)' }}
                        />
                    </div>

                    {/* VOID DEPTH */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                            <span>VOID DEPTH (SPACE)</span>
                            <span>{(state.vocalFX.voidDepth * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.1" 
                            value={state.vocalFX.voidDepth}
                            onChange={(e) => setState(prev => ({ ...prev, vocalFX: { ...prev.vocalFX, voidDepth: parseFloat(e.target.value) } }))}
                            style={{ width: '100%', accentColor: 'var(--neon-cyan)' }}
                        />
                    </div>

                     {/* DISTORTION */}
                     <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                            <span>SIGNAL DEGRADATION (GRIT)</span>
                            <span>{(state.vocalFX.distortion * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="1" step="0.1" 
                            value={state.vocalFX.distortion}
                            onChange={(e) => setState(prev => ({ ...prev, vocalFX: { ...prev.vocalFX, distortion: parseFloat(e.target.value) } }))}
                            style={{ width: '100%', accentColor: 'var(--neon-acid)' }}
                        />
                    </div>

                </div>
            </div>

            {state.musicalPlan && state.musicalPlan.sections.map((section, idx) => (
                <div key={idx} style={{ background: state.vocalTracksBuffers[idx] ? 'rgba(0, 243, 255, 0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid #333', padding: '15px', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', color: '#fff' }}>{idx + 1}. {section.name}</div>
                    <button onClick={() => handleGenerateVocalForSection(idx)} disabled={state.isLoading || !section.text} style={{ fontSize: '10px', background: '#333', border: 'none', color: '#fff', padding: '5px 10px' }}>{state.vocalTracksBuffers[idx] ? 'RE-TAKE' : 'RECORD'}</button>
                </div>
            ))}
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
                 <button className="primary-action" onClick={() => setState(prev => ({ ...prev, step: 'mastering' }))}>ENTER MASTERING >></button>
            </div>
        </div>
    );

    const renderMasteringStep = () => (
        <div className="layout-max-width">
             <button onClick={() => setState(prev => ({ ...prev, step: 'vocals' }))} disabled={state.isLoading} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: '20px' }}>&lt;&lt; BACK TO SESSION</button>
             <h3 style={{ fontSize: '14px', color: 'var(--neon-cyan)', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '20px' }}>Phase 5 // Mastering Console</h3>
            {!state.finalMixUrl ? (
                 <button onClick={handleMixDown} disabled={state.isLoading} className="primary-action" style={{ width: '100%', padding: '20px' }}>RENDER FINAL MASTER</button>
            ) : (
                <div style={{ textAlign: 'center' }}>
                     {/* SPECTRUM ANALYZER (FL STUDIO STYLE) */}
                     <SpectrumAnalyzer audioRef={audioRef} />
                     
                     <audio ref={audioRef} controls src={state.finalMixUrl} style={{ width: '100%', marginBottom: '20px', filter: 'invert(1) hue-rotate(180deg)' }}></audio>
                     <div style={{ fontSize: '10px', color: '#666', marginBottom: '20px' }}>*RENDER includes Vocal Forge effects. Rerender if you changed settings.</div>
                     
                     {/* THE QUANTUM MUTATOR (NEZHA ENGINE) */}
                     <div style={{ 
                         background: 'rgba(5,0,10,0.8)', 
                         border: '1px solid var(--neon-acid)', 
                         padding: '20px', 
                         margin: '20px 0',
                         display: 'flex',
                         flexDirection: 'column',
                         gap: '15px'
                     }}>
                         <div style={{ color: 'var(--neon-acid)', fontSize: '10px', letterSpacing: '2px', fontWeight: 'bold' }}>// QUANTUM MUTATOR (NEZHA RECONSTRUCTION)</div>
                         <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                             <span style={{ fontSize: '10px', color: '#888' }}>ENTROPY LEVEL</span>
                             <input type="range" min="0" max="1" step="0.1" value={state.entropyLevel} onChange={(e) => setState(prev => ({ ...prev, entropyLevel: parseFloat(e.target.value) }))} style={{ flex: 1, accentColor: 'var(--neon-acid)' }} />
                             <span style={{ fontSize: '10px', color: 'var(--neon-acid)' }}>{(state.entropyLevel * 100).toFixed(0)}%</span>
                         </div>
                         
                         <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                             <span style={{ fontSize: '10px', color: '#888' }}>ALBIN TERMINAL ></span>
                             <input 
                                type="text" 
                                placeholder="ENTER VOID COMMAND..." 
                                value={state.voidCommandInput}
                                onChange={(e) => setState(prev => ({...prev, voidCommandInput: e.target.value.toUpperCase()}))}
                                style={{ flex: 1, background: '#000', border: '1px solid #333', color: '#fff', fontSize: '10px', padding: '5px', fontFamily: 'monospace' }}
                             />
                         </div>
                         
                         <button onClick={handleQuantumMutation} disabled={state.isLoading} className="primary-action" style={{ background: 'var(--neon-acid)', color: '#000' }}>
                             {state.isLoading && state.currentOperation === 'mutation' ? 'RECONSTRUCTING REALITY...' : 'INITIATE LOTUS RECONSTRUCTION'}
                         </button>
                         {state.voidCommandInput && Object.keys(VOID_COMMANDS).includes(state.voidCommandInput) && (
                             <div style={{ fontSize: '10px', color: 'var(--neon-cyan)' }}>>> COMMAND RECOGNIZED: {state.voidCommandInput}</div>
                         )}
                     </div>

                     {/* THE MONKEY KING'S ARMORY */}
                     <div style={{ 
                         background: 'rgba(20,5,0,0.8)', 
                         border: '1px solid #FFD700', 
                         padding: '20px', 
                         margin: '20px 0',
                         display: 'flex',
                         flexDirection: 'column',
                         gap: '15px'
                     }}>
                         <div style={{ color: '#FFD700', fontSize: '10px', letterSpacing: '2px', fontWeight: 'bold' }}>// WUKONG PROTOCOL (REALITY BENDER)</div>
                         <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                             <button onClick={handleWukongClone} disabled={state.isLoading} className="primary-action" style={{ background: '#FFD700', color: '#000', border: 'none', flex: 1 }}>
                                 HAIR OF THE MONKEY (LEGION)
                             </button>
                             <button onClick={() => { setState(prev => ({...prev, voidCommandInput: 'CMD: WUKONG_STAFF_MAX'})); setTimeout(handleQuantumMutation, 100); }} disabled={state.isLoading} className="primary-action" style={{ background: 'transparent', border: '1px solid #FFD700', color: '#FFD700', flex: 1 }}>
                                 GOLDEN STAFF: MAXIMIZE (HEAVY)
                             </button>
                             <button onClick={() => { setState(prev => ({...prev, voidCommandInput: 'CMD: WUKONG_STAFF_MIN'})); setTimeout(handleQuantumMutation, 100); }} disabled={state.isLoading} className="primary-action" style={{ background: 'transparent', border: '1px solid #FFD700', color: '#FFD700', flex: 1 }}>
                                 GOLDEN STAFF: MINIMIZE (LIGHT)
                             </button>
                         </div>
                         <div style={{ fontSize: '9px', color: '#888', textAlign: 'center' }}>*Directly manipulates spectral density and harmonic multiplication.</div>
                     </div>

                     <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setState(prev => ({ ...prev, finalMixUrl: null, finalMixBlob: null }))} className="primary-action" style={{ flex: 1, background: '#333', color: '#fff' }}>RE-MIX</button>
                        <button className="primary-action" onClick={handleManifestation} style={{ flex: 2 }}>PHASE 6: MANIFESTATION >></button>
                     </div>
                </div>
            )}
        </div>
    );

    const renderManifestationStep = () => (
        <div className="layout-max-width">
            <h3 style={{ fontSize: '14px', color: 'var(--neon-cyan)', textTransform: 'uppercase', marginBottom: '20px' }}>Phase 6 // Manifestation</h3>
            
            {/* SHOWTIME SELECTOR (SING vs SOUL) */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button 
                    onClick={() => setState(prev => ({...prev, visualLens: 'Miyazaki Savannah'}))}
                    style={{ padding: '10px', border: state.visualLens === 'Miyazaki Savannah' ? '1px solid var(--neon-cyan)' : '1px solid #333', color: '#fff' }}
                >
                    MIYAZAKI SAVANNAH (GHIBLI)
                </button>
                <button 
                    onClick={() => setState(prev => ({...prev, visualLens: 'Trigger Kinetic'}))}
                    style={{ padding: '10px', border: state.visualLens === 'Trigger Kinetic' ? '1px solid #FF0055' : '1px solid #333', color: '#FF0055' }}
                >
                    TRIGGER KINETIC (ACTION)
                </button>
                <button 
                    onClick={() => setState(prev => ({...prev, visualLens: 'Ufotable Night'}))}
                    style={{ padding: '10px', border: state.visualLens === 'Ufotable Night' ? '1px solid #7B68EE' : '1px solid #333', color: '#7B68EE' }}
                >
                    UFOTABLE NIGHT (MYSTIC)
                </button>
                <button 
                    onClick={() => setState(prev => ({...prev, visualLens: 'Shinkai Sky'}))}
                    style={{ padding: '10px', border: state.visualLens === 'Shinkai Sky' ? '1px solid #00F3FF' : '1px solid #333', color: '#00F3FF' }}
                >
                    SHINKAI SKY (EMOTIONAL)
                </button>
            </div>

            {state.visualManifest && (
                <div>
                     <canvas ref={canvasRef} width={800} height={450} style={{ width: '100%', display: 'block', aspectRatio: '16/9', background: '#000', marginBottom: '20px' }} />
                     {state.finalMixUrl && <audio ref={audioRef} src={state.finalMixUrl} controls style={{ width: '100%', filter: 'invert(1)' }} onPlay={() => generateAnimatic(canvasRef.current!, state.musicalPlan!.sections.map(s => ({ partLabel: s.name, startTime: s.startTime || 0, endTime: (s.startTime || 0) + 10, text: s.text || '', imageUrl: state.visualManifest!.keyframes.find(k => k.section === s.name)?.imageUrl || state.visualManifest!.keyframes[0].imageUrl })), 'dynamic', analyserRef.current!)} />}
                     <button className="primary-action" onClick={() => setState(prev => ({ ...prev, step: 'release' }))} style={{ marginTop: '20px', float: 'right' }}>PROCEED TO RELEASE >></button>
                </div>
            )}
        </div>
    );

    const renderReleaseStep = () => (
         <div className="layout-max-width">
             <h3 style={{ fontSize: '14px', color: 'var(--neon-cyan)', textTransform: 'uppercase', marginBottom: '20px' }}>Phase 7 // Release</h3>
             {!state.releasePackage ? (
                 <button onClick={handleReleaseStrategy} disabled={state.isLoading} className="primary-action" style={{ padding: '20px 40px' }}>INITIATE RELEASE STRATEGY</button>
             ) : (
                 <div style={{ border: '1px solid var(--neon-cyan)', padding: '20px' }}>
                     <div style={{ fontSize: '40px', color: '#fff' }}>VIRAL SCORE: {state.releasePackage.viralScore}</div>
                     <div>{state.releasePackage.elevatorPitch}</div>
                 </div>
             )}
         </div>
    );

    return (
        <div className="app-container-3d">
            {renderHeader()}
            {renderPhaseNav()}
            {renderLoadingOverlay()}
            {state.step === 'lyrics' && renderLyricsStep()}
            {state.step === 'persona' && renderPersonaStep()}
            {state.step === 'instrumental' && renderInstrumentalStep()}
            {state.step === 'vocals' && renderVocalsStep()}
            {state.step === 'mastering' && renderMasteringStep()}
            {state.step === 'manifestation' && renderManifestationStep()}
            {state.step === 'release' && renderReleaseStep()}
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}