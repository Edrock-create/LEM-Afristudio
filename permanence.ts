
// ANIMA LOCI: THE CHRONOS PROTOCOL
// Module: Persistence & State Immortality Engine

import { MixerSettings, MusicalPlan } from "./audioUtils";

// --- CONSTANTS ---
const DB_NAME = "AnimaLoci_Chronos_Vault";
const DB_VERSION = 2;
const STORE_BLOBS = "binary_assets"; // Stores Audio Blobs
const LOCAL_STORAGE_KEY = "animaLoci_Akashic_Record";
const MAX_SNAPSHOTS = 10;

// --- TYPES ---

export interface ChronosState {
    timestamp: number;
    step: string;
    topic: string;
    lyrics: string;
    selectedVoice: string | null;
    selectedStyle: string | null;
    musicalPlan: MusicalPlan | null;
    mixerSettings: MixerSettings;
    visualLens: string;
    // We store IDs here, not the heavy blobs. The IDs map to IndexedDB.
    assetMap: {
        instrumentalId: string | null;
        vocalTrackIds: Record<number, string>; // sectionIndex -> blobId
        finalMixId: string | null;
    };
}

interface Snapshot {
    id: string;
    timestamp: number;
    description: string;
    data: ChronosState;
}

// --- THE BINARY VAULT (IndexedDB Wrapper) ---

class BinaryVault {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                    db.createObjectStore(STORE_BLOBS);
                }
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error("Chronos Vault: Initialization Failed", event);
                reject("Vault Lockdown");
            };
        });
    }

    async saveBlob(id: string, blob: Blob): Promise<void> {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([STORE_BLOBS], "readwrite");
            const store = tx.objectStore(STORE_BLOBS);
            const req = store.put(blob, id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject("Blob Crystallization Failed");
        });
    }

    async getBlob(id: string): Promise<Blob | null> {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction([STORE_BLOBS], "readonly");
            const store = tx.objectStore(STORE_BLOBS);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null); // Fail gracefully
        });
    }
}

// --- ENTROPY CALCULATOR (Checksums) ---

function generateChecksum(data: string): string {
    let hash = 0, i, chr;
    if (data.length === 0) return hash.toString(16);
    for (i = 0; i < data.length; i++) {
        chr = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
}

// --- THE CHRONOS ENGINE ---

export class Chronos {
    private static instance: Chronos;
    private vault: BinaryVault;
    private snapshots: Snapshot[] = [];
    private isGhostMode: boolean = false; // THE IMPERMANENCE FLAG

    private constructor() {
        this.vault = new BinaryVault();
    }

    public static getInstance(): Chronos {
        if (!Chronos.instance) {
            Chronos.instance = new Chronos();
        }
        return Chronos.instance;
    }

    // TOGGLE THE GHOST PROTOCOL
    public setGhostMode(enabled: boolean) {
        this.isGhostMode = enabled;
        if (enabled) {
            console.warn("[CHRONOS] GHOST PROTOCOL ENGAGED. PERSISTENCE SEVERED.");
        } else {
            console.log("[CHRONOS] TIMELINE ANCHORED. PERSISTENCE RESTORED.");
        }
    }

    public getGhostMode(): boolean {
        return this.isGhostMode;
    }

    // 1. CRYSTALLIZE (Save State)
    async crystallize(
        appState: any, 
        currentBlobs: { 
            instrumental: Blob | null, 
            vocals: Record<number, Blob>, 
            mix: Blob | null 
        },
        reason: string = "Auto-Save"
    ): Promise<void> {
        
        // --- IMPERMANENCE CHECK ---
        if (this.isGhostMode) {
            console.log(`[CHRONOS] Crystallization Blocked by Ghost Protocol. State is volatile.`);
            return;
        }
        // --------------------------

        // A. Map Blobs to IDs
        const assetMap = {
            instrumentalId: currentBlobs.instrumental ? "inst_" + generateChecksum(appState.topic) : null,
            vocalTrackIds: {} as Record<number, string>,
            finalMixId: currentBlobs.mix ? "mix_" + generateChecksum(appState.lyrics) : null
        };

        // B. Store Blobs in Vault (Async)
        const promises = [];
        if (currentBlobs.instrumental && assetMap.instrumentalId) {
            promises.push(this.vault.saveBlob(assetMap.instrumentalId, currentBlobs.instrumental));
        }
        if (currentBlobs.mix && assetMap.finalMixId) {
            promises.push(this.vault.saveBlob(assetMap.finalMixId, currentBlobs.mix));
        }
        
        Object.entries(currentBlobs.vocals).forEach(([key, blob]) => {
            const idx = parseInt(key);
            const id = `vox_${idx}_${generateChecksum(appState.topic)}`;
            assetMap.vocalTrackIds[idx] = id;
            promises.push(this.vault.saveBlob(id, blob));
        });

        await Promise.all(promises);

        // C. Create Lightweight State
        const chronosState: ChronosState = {
            timestamp: Date.now(),
            step: appState.step,
            topic: appState.topic,
            lyrics: appState.lyrics,
            selectedVoice: appState.selectedVoice,
            selectedStyle: appState.selectedStyle,
            musicalPlan: appState.musicalPlan,
            mixerSettings: appState.mixerSettings,
            visualLens: appState.visualLens || 'Cinematic',
            assetMap: assetMap
        };

        // D. Create Snapshot & Trim History
        const snapshot: Snapshot = {
            id: Date.now().toString(36),
            timestamp: Date.now(),
            description: reason,
            data: chronosState
        };

        this.snapshots.unshift(snapshot);
        if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.pop();

        // E. Commit to Akashic Record (LocalStorage)
        const serialized = JSON.stringify({
            current: chronosState,
            history: this.snapshots.map(s => ({ id: s.id, timestamp: s.timestamp, description: s.description })) // Don't store full history data in LS to save space
        });
        
        const checksum = generateChecksum(serialized);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ payload: serialized, hash: checksum }));
        
        console.log(`[CHRONOS] Reality Crystallized. Reason: ${reason}. Checksum: ${checksum}`);
    }

    // 2. RESURRECT (Load State)
    async resurrect(): Promise<{ 
        success: boolean, 
        state?: ChronosState, 
        blobs?: { instrumental: Blob | null, vocals: Record<number, Blob>, mix: Blob | null },
        message?: string 
    }> {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return { success: false, message: "No Akashic Record Found." };

        try {
            const { payload, hash } = JSON.parse(raw);
            
            // A. Entropy Check
            if (generateChecksum(payload) !== hash) {
                console.error("[CHRONOS] ENTROPY DETECTED. DATA CORRUPTION.");
                return { success: false, message: "CRITICAL: Timeline Corrupted. Checksum Mismatch." };
            }

            const parsed = JSON.parse(payload);
            const state: ChronosState = parsed.current;
            
            // B. Rehydrate Blobs from Vault
            const blobs = {
                instrumental: null as Blob | null,
                vocals: {} as Record<number, Blob>,
                mix: null as Blob | null
            };

            if (state.assetMap.instrumentalId) {
                blobs.instrumental = await this.vault.getBlob(state.assetMap.instrumentalId);
            }
            if (state.assetMap.finalMixId) {
                blobs.mix = await this.vault.getBlob(state.assetMap.finalMixId);
            }
            
            for (const [key, id] of Object.entries(state.assetMap.vocalTrackIds)) {
                const b = await this.vault.getBlob(id as string);
                if (b) blobs.vocals[parseInt(key)] = b;
            }

            return { success: true, state, blobs, message: "Reality Successfully Restored." };

        } catch (e) {
            console.error("Resurrection Failed", e);
            return { success: false, message: "Resurrection Protocol Failed." };
        }
    }

    // 3. GET TIMELINE (For UI)
    getTimeline(): { id: string, time: string, desc: string }[] {
        return this.snapshots.map(s => ({
            id: s.id,
            time: new Date(s.timestamp).toLocaleTimeString(),
            desc: s.description
        }));
    }
}
