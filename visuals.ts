
// This module handles the "Production" phase: Animatic generation and Unreal Engine integration.

import { EmotionalArc, ThemeCore, LyricTiming, CinematicDirection } from './types';
import { getAiClient } from './api';
import { VISUAL_DIRECTOR_INSTRUCTION, MATRIX_INTEGRITY_INSTRUCTION } from './warmablon';
import { MusicalPlan } from './audioUtils';
import { Type } from '@google/genai';

let animationFrameId: number;

export interface VisionKeyframe {
    section: string;
    description: string;
    imageUrl: string;
}

export interface VisualManifest {
    keyframes: VisionKeyframe[];
    unrealScript: string;
    theme: string;
}

// --- 1. THE VISUAL DIRECTOR ENGINE ---

export async function generateVisionBoard(
    lyrics: string,
    musicalPlan: MusicalPlan,
    visualLens: string, // EVOLUTION: New Parameter
    onProgress: (percent: number, message: string) => void
): Promise<VisualManifest | null> {
    const ai = getAiClient();

    // 1. Analyze and Describe Keyframes
    onProgress(10, "Visual Director: Dreaming of scenes...");
    
    const analysisPrompt = `
    Analyze the following song lyrics and musical plan.
    Generate a visual description for 4 keyframes: Intro, Verse, Chorus, Climax.
    
    VISUAL LENS FILTER: ${visualLens}. 
    Ensure all descriptions strictly adhere to this visual style (e.g. if Noir, use shadows/black & white; if Cyberpunk, use neon/rain).
    
    Base Style: High-Fidelity Anime (A-1 Pictures style), Cinematic Lighting, Unreal Engine 5 quality.
    
    Lyrics snippet: "${lyrics.substring(0, 300)}..."
    Style: ${musicalPlan.style || 'General'}
    BPM: ${musicalPlan.bpm}

    Return JSON matching the schema.
    `;

    try {
        const analysisResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: analysisPrompt,
            config: {
                systemInstruction: `${VISUAL_DIRECTOR_INSTRUCTION}\n${MATRIX_INTEGRITY_INSTRUCTION}`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        themeSummary: { type: Type.STRING },
                        keyframes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    section: { type: Type.STRING },
                                    prompt: { type: Type.STRING, description: "Detailed image generation prompt" }
                                }
                            }
                        }
                    }
                }
            }
        });

        const analysis = JSON.parse(analysisResponse.text);
        const generatedKeyframes: VisionKeyframe[] = [];

        // 2. Generate Images for each Keyframe
        const totalFrames = analysis.keyframes.length;
        for (let i = 0; i < totalFrames; i++) {
            const frame = analysis.keyframes[i];
            onProgress(20 + (i / totalFrames) * 50, `Rendering Keyframe ${i + 1}/${totalFrames}: ${frame.section}...`);
            
            try {
                // EVOLUTION: STRICT MASTERPIECE INJECTION
                // We mechanically append these tokens to ensure the "No Trash Data" rule is followed.
                const masterpieceModifiers = "Masterpiece, Award-Winning Cinematography, 8k Resolution, Highly Detailed, Perfect Lighting, Global Stage, High Budget";
                const modifiedPrompt = `${frame.prompt}, ${masterpieceModifiers} --style ${visualLens} --aspect-ratio 16:9 --style anime`;
                
                const imageResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: {
                        parts: [{ text: modifiedPrompt }]
                    }
                });

                let imageUrl = "https://placehold.co/600x400/000000/FFFFFF/png?text=Image+Gen+Error";
                
                if (imageResponse.candidates?.[0]?.content?.parts) {
                    for (const part of imageResponse.candidates[0].content.parts) {
                        if (part.inlineData) {
                            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                            break;
                        }
                    }
                }

                generatedKeyframes.push({
                    section: frame.section,
                    description: frame.prompt,
                    imageUrl: imageUrl
                });

            } catch (imgError) {
                console.warn(`Failed to generate image for ${frame.section}`, imgError);
                generatedKeyframes.push({
                    section: frame.section,
                    description: frame.prompt,
                    imageUrl: "https://placehold.co/600x400/111/444/png?text=Visual+Signal+Lost" // Fallback
                });
            }
        }

        // 3. Generate Unreal Engine Script
        onProgress(80, "Compiling Unreal Engine 5 Python Script...");
        const unrealScript = generateUnrealScriptInternal(musicalPlan, analysis.keyframes);

        onProgress(100, "Manifestation Complete.");
        
        return {
            keyframes: generatedKeyframes,
            unrealScript: unrealScript,
            theme: analysis.themeSummary
        };

    } catch (e) {
        console.error("Visual Director failed:", e);
        return null;
    }
}

function generateUnrealScriptInternal(plan: MusicalPlan, keyframes: any[]): string {
    const bpm = plan.bpm;
    const totalBars = plan.sections.reduce((acc, s) => acc + s.barCount, 0);
    const duration = (totalBars * 4 * 60) / bpm;
    
    return `import unreal

# ANIMA LOCI: UNREAL ENGINE BRIDGE
# Auto-generated Script for ${plan.style} Track
# BPM: ${bpm} | Duration: ${duration.toFixed(2)}s

def build_manifestation():
    # 1. Setup Sequence
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    sequence = asset_tools.create_asset(asset_name="AnimaLoci_Sequence", package_path="/Game/Cinematics", asset_class=unreal.LevelSequence, factory=unreal.LevelSequenceFactoryNew())
    
    # 2. Set FPS and Playback Range
    sequence.set_display_rate(unreal.FrameRate(30, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(${Math.floor(duration * 30)})
    
    # 3. Create Camera
    camera_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(0, 0, 100))
    camera_cut_track = sequence.add_master_track(unreal.MovieSceneCameraCutTrack)
    camera_cut_section = camera_cut_track.add_section()
    camera_cut_section.set_range(0, ${Math.floor(duration * 30)})
    
    binding = sequence.add_possessable(camera_actor)
    camera_cut_section.set_camera_binding_id(binding.get_binding_id())

    # 4. Animate Camera (Based on BPM)
    transform_track = binding.add_track(unreal.MovieScene3DTransformTrack)
    transform_section = transform_track.add_section()
    transform_section.set_range(0, ${Math.floor(duration * 30)})
    
    # Keyframes (Simple Dolly Zoom)
    # Start
    transform_section.get_all_channels()[0].add_key(unreal.FrameNumber(0), 0.0) # X
    transform_section.get_all_channels()[1].add_key(unreal.FrameNumber(0), 0.0) # Y
    transform_section.get_all_channels()[2].add_key(unreal.FrameNumber(0), 150.0) # Z
    
    # End
    end_frame = unreal.FrameNumber(${Math.floor(duration * 30)})
    transform_section.get_all_channels()[0].add_key(end_frame, 1000.0) # Move forward 1000 units
    
    print("Manifestation Sequence Created: /Game/Cinematics/AnimaLoci_Sequence")
    print("Visual Style Target: Anime/Cinematic")

if __name__ == "__main__":
    build_manifestation()
`;
}

// --- 2. PIXEL STREAMING CONTROLLER (MOCK) ---
export class PixelStreamer {
    videoElement: HTMLVideoElement;
    isConnected: boolean = false;

    constructor(videoElement: HTMLVideoElement) {
        this.videoElement = videoElement;
    }

    async connect(signalingUrl: string) {
        console.log(`Connecting to Pixel Streaming Server at ${signalingUrl}...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        this.isConnected = true;
        this.videoElement.poster = "https://cdn.dribbble.com/users/1208684/screenshots/15694389/media/c0714c62254336c53d5a06708608246e.jpg?resize=1600x1200&vertical=center"; 
        this.videoElement.play().catch(e => console.log("Autoplay blocked", e));
        return true;
    }

    emitUIInteraction(data: any) {
        if (!this.isConnected) return;
        console.log("Sending UI Interaction to Unreal:", data);
    }
}

// --- 3. ANIMATIC ENGINE (2D STORYBOARD) ---
// Note: lyricTimings can now contain an `imageUrl` property for mapping visuals to time
interface ExtendedLyricTiming extends LyricTiming {
    imageUrl?: string;
}

export function generateAnimatic(
    canvas: HTMLCanvasElement, 
    lyricTimings: ExtendedLyricTiming[], 
    direction: CinematicDirection,
    analyser?: AnalyserNode 
) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Preload images
    const imageCache: Record<string, HTMLImageElement> = {};
    lyricTimings.forEach(l => {
        if (l.imageUrl && !imageCache[l.imageUrl]) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = l.imageUrl;
            imageCache[l.imageUrl] = img;
        }
    });
    
    const startTime = Date.now();
    let currentImageSrc = lyricTimings[0]?.imageUrl;
    let transitionStart = 0;
    
    const animate = () => {
        const now = Date.now();
        const elapsedTime = (now - startTime) / 1000;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Audio Analysis (Bass for shake)
        let bass = 0;
        let highs = 0;
        if (analyser) {
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate Bass (Low Freqs)
            let sumBass = 0;
            for(let i=0; i<bufferLength/10; i++) sumBass += dataArray[i]; 
            bass = sumBass / (bufferLength/10) / 255;

            // Calculate Highs (High Freqs for Glitch)
            let sumHighs = 0;
            for(let i=Math.floor(bufferLength * 0.7); i<bufferLength; i++) sumHighs += dataArray[i];
            highs = sumHighs / (bufferLength * 0.3) / 255;
        }

        // Determine current section
        const totalDuration = lyricTimings[lyricTimings.length-1]?.endTime || 180;
        const loopedTime = elapsedTime % totalDuration;
        const currentSection = lyricTimings.find(l => loopedTime >= l.startTime && loopedTime < l.endTime) || lyricTimings[0];
        
        // Handle Image Switching
        if (currentSection && currentSection.imageUrl !== currentImageSrc) {
            currentImageSrc = currentSection.imageUrl;
            transitionStart = now; // Mark transition time for fade effect
        }

        const img = currentImageSrc ? imageCache[currentImageSrc] : null;

        if (img && img.complete) {
            // LISWANISO'S OPTIC NERVE: CHROMATIC ABERRATION LOGIC
            const shakeX = (Math.random() - 0.5) * bass * 40;
            const shakeY = (Math.random() - 0.5) * bass * 40;
            
            // Base Scale + Bass Pulse
            const scale = 1.0 + (Math.sin(elapsedTime * 0.1) * 0.05) + (bass * 0.05);
            
            // --- DRAWING WITH RGB SPLIT (CHROMATIC ABERRATION) ---
            // If bass is high, we draw the image 3 times with offset colors
            
            // Helper to draw image state
            const drawLayer = (colorMask: string | null, offsetX: number, offsetY: number) => {
                ctx.save();
                ctx.translate(width / 2, height / 2);
                ctx.scale(scale, scale);
                ctx.translate((-width / 2) + shakeX + offsetX, (-height / 2) + shakeY + offsetY);
                
                const imgAspect = img.width / img.height;
                const canvasAspect = width / height;
                let drawW, drawH;
                if (imgAspect > canvasAspect) { drawH = height; drawW = height * imgAspect; } 
                else { drawW = width; drawH = width / imgAspect; }
                
                if (colorMask) {
                    ctx.globalCompositeOperation = 'screen'; // Additive blending for RGB split
                    // This is a simplified simulation of channel splitting using transparency/tinting
                    // True channel splitting requires pixel manipulation which is slow for JS canvas at 60fps
                    // So we use composite operations
                    ctx.globalAlpha = 0.7 * bass; 
                }

                ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
                
                // Color Tinting Overlay for Split Effect
                if (colorMask) {
                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.fillStyle = colorMask;
                    ctx.fillRect((width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
                }
                
                ctx.restore();
            };

            // 1. Red Channel (Offset Left on Bass)
            if (bass > 0.3) drawLayer('rgba(255,0,0,0.5)', -10 * bass, 0);
            
            // 2. Blue Channel (Offset Right on Bass)
            if (bass > 0.3) drawLayer('rgba(0,0,255,0.5)', 10 * bass, 0);
            
            // 3. Main Image (Normal)
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            drawLayer(null, 0, 0);

        } else {
            // Loading placeholder
            ctx.fillStyle = "#0a0f18";
            ctx.fillRect(0,0,width,height);
            ctx.fillStyle = "rgba(0, 243, 255, 0.5)";
            ctx.font = "12px 'Roboto Mono'";
            ctx.textAlign = "center";
            ctx.fillText("LOADING ASSETS // BUFFERING REALITY...", width/2, height/2);
        }

        // --- SCANLINES & NOISE (POST PROCESSING) ---
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        
        // Scanlines
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        for (let i = 0; i < height; i += 4) {
            ctx.fillRect(0, i, width, 1);
        }
        
        // Glitch Blocks (Random digital artifacts based on Highs)
        if (highs > 0.4) {
            ctx.fillStyle = `rgba(0, 243, 255, ${highs * 0.5})`;
            for(let k=0; k<5; k++) {
                const bx = Math.random() * width;
                const by = Math.random() * height;
                const bw = Math.random() * 100;
                const bh = Math.random() * 5;
                ctx.fillRect(bx, by, bw, bh);
            }
        }
        ctx.restore();


        // Overlay Text (Section Headers)
        if (currentSection) {
            ctx.save();
            ctx.font = "bold 60px 'Roboto Mono'";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)"; // Giant watermark style
            ctx.fillText(currentSection.partLabel.toUpperCase(), width / 2, height / 2);
            
            // Active Lyric / Header
            ctx.font = "bold 24px 'Roboto Mono'";
            ctx.fillStyle = "#00f3ff";
            ctx.shadowColor = "rgba(0, 243, 255, 0.8)";
            ctx.shadowBlur = 20;
            ctx.globalAlpha = 0.8 + (bass * 0.2); // Text pulsates
            ctx.fillText(`[ ${currentSection.partLabel.toUpperCase()} ]`, width / 2, height - 50);
            ctx.restore();
        }
        
        // Cinematic Letterbox
        ctx.fillStyle = "black";
        const barHeight = height * 0.12;
        ctx.fillRect(0, 0, width, barHeight);
        ctx.fillRect(0, height - barHeight, width, barHeight);
        
        // HUD Overlay
        ctx.font = "10px 'Roboto Mono'";
        ctx.fillStyle = "rgba(121, 230, 243, 0.8)";
        ctx.textAlign = "left";
        ctx.fillText(`REC ● SOURCE-Z: ${bass.toFixed(2)} / ${highs.toFixed(2)}`, 20, 30);
        ctx.textAlign = "right";
        
        // Audio Viz Bars (Simple)
        const numBars = 20;
        ctx.fillStyle = "#00f3ff";
        for(let i=0; i<numBars; i++) {
             const h = (bass * 150) * Math.random();
             ctx.fillRect(width - 40 - (i*6), 30, 4, h);
        }

        animationFrameId = requestAnimationFrame(animate);
    };
    animate();
}
