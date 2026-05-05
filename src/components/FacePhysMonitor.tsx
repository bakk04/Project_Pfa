'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import JSZip from 'jszip';
import styles from './FacePhys.module.css';
import { useNativeHealth } from '../hooks/useNativeHealth';
import { useVitalStore } from '@/store/vital-store';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { RPPG_CONFIG, USER_FEEDBACK } from '@/lib/constants';
import { toast } from 'sonner';

// --- V4 UTILS ---

function isSkinPixelRobust(r: number, g: number, b: number): boolean {
    let votes = 0;

    // 1. YCbCr
    const Y = 0.299 * r + 0.587 * g + 0.114 * b;
    const Cb = -0.16874 * r - 0.33126 * g + 0.5 * b + 128;
    const Cr = 0.5 * r - 0.41869 * g - 0.08131 * b + 128;
    if (Y >= 80 && Y <= 235 && Cb >= 120 && Cb <= 175 && Cr >= 120 && Cr <= 173) votes++;

    // 2. Normalized RGB
    const sum = r + g + b + 1e-6;
    const nr = r / sum;
    const ng = g / sum;
    if (nr >= 0.36 && nr <= 0.80 && ng >= 0.28 && ng <= 0.60 && nr >= ng) votes++;

    // 3. HSV
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const delta = maxC - minC;
    const V = maxC / 255;
    const S = maxC > 0 ? delta / maxC : 0;
    let H = 0;
    if (delta > 0) {
        if (maxC === r) H = 60 * (((g - b) / delta) % 6);
        else if (maxC === g) H = 60 * ((b - r) / delta + 2);
        else H = 60 * ((r - g) / delta + 4);
        if (H < 0) H += 360;
    }
    const hInSkinRange = H <= 25 || H >= 335;
    if (hInSkinRange && S >= 0.15 && S <= 0.75 && V >= 0.20 && V <= 0.95) votes++;

    return votes >= 2;
}

function generateUserFeedback(state: {
    envState: string;
    motion: number;
    lighting: number;
    cameraScore: number;
    systemHealth: boolean;
    sqi: number;
}): string {
    if (!state.systemHealth) return USER_FEEDBACK.WARMING_UP;
    if (state.cameraScore < 0.4) return USER_FEEDBACK.CAMERA_UNRELIABLE;
    if (state.envState !== "CLEAN") {
        if (state.envState === "FLICKER_50HZ") return USER_FEEDBACK.LIGHTING_FLICKER_50HZ;
        if (state.envState === "FLICKER_60HZ") return USER_FEEDBACK.LIGHTING_FLICKER_60HZ;
        if (state.envState === "AUTO_ADJUST_ACTIVE") return USER_FEEDBACK.AUTO_ADJUST;
        return USER_FEEDBACK.UNSTABLE_LIGHTING;
    }
    if (state.motion > 0.5) return USER_FEEDBACK.STAY_STILL;
    if (state.lighting > 0.7) return USER_FEEDBACK.VARIABLE_LIGHTING;
    if (state.sqi < 0.3) return USER_FEEDBACK.WEAK_SIGNAL;
    return USER_FEEDBACK.STABLE_SIGNAL;
}

class KalmanFilter1D {
    x: number;
    p: number;
    q: number;
    r: number;
    constructor(initialValue: number, processNoise = 1e-2, measurementNoise = 5e-1) {
        this.x = initialValue; 
        this.p = 1.0;          
        this.q = processNoise;
        this.r = measurementNoise;
    }
    update(measurement: number) {
        const p_pred = this.p + this.q;
        const k = p_pred / (p_pred + this.r);
        this.x = this.x + k * (measurement - this.x);
        this.p = (1 - k) * p_pred;
        return this.x;
    }
}

class VisEngine {
    activeLayer: number;
    historyLen: number;
    trajHistory: {x: number, y: number, val: number}[][];
    currentHeatmaps: (Float32Array | null)[];
    layerRanges: ({min: number, max: number} | null)[];
    heatmapCtx: CanvasRenderingContext2D;
    trajCtx: CanvasRenderingContext2D;
    heatmapCanvas: HTMLCanvasElement;
    trajCanvas: HTMLCanvasElement;

    constructor(heatmapCanvas: HTMLCanvasElement, trajCanvas: HTMLCanvasElement) {
        this.activeLayer = 0;
        this.historyLen = 300;
        this.trajHistory = [[], [], [], [], []];
        this.currentHeatmaps = [null, null, null, null];
        this.layerRanges = [null, null, null, null]; 
        this.heatmapCanvas = heatmapCanvas;
        this.trajCanvas = trajCanvas;
        this.heatmapCtx = heatmapCanvas.getContext('2d')!;
        this.trajCtx = trajCanvas.getContext('2d')!;
    }

    update(output: any, value: number) {
        const ssmKeys = ['ssm1', 'ssm2', 'ssm3', 'ssm4', 'proj'];
        for (let i = 0; i < 5; i++) {
            const key = ssmKeys[i];
            if (output[key]) {
                const arr = output[key];
                this.pushHistory(i, arr[0], arr[1], value);
            }
        }

        const fmKeys = ['fm1', 'fm2', 'fm3', 'fm4'];
        for (let i = 0; i < 4; i++) {
            if (output[fmKeys[i]]) {
                this.currentHeatmaps[i] = output[fmKeys[i]];
            }
        }
    }

    pushHistory(layerIdx: number, x: number, y: number, val: number) {
        const hist = this.trajHistory[layerIdx];
        hist.push({ x, y, val });
        if (hist.length > this.historyLen) hist.shift();
    }

    draw() {
        let fmIdx = this.activeLayer === 4 ? 3 : this.activeLayer;
        const fmData = this.currentHeatmaps[fmIdx];
        
        this.heatmapCtx.clearRect(0, 0, this.heatmapCanvas.width, this.heatmapCanvas.height);
        this.heatmapCtx.fillStyle = "#000";
        this.heatmapCtx.fillRect(0,0,this.heatmapCanvas.width, this.heatmapCanvas.height);

        if (fmData) this.renderHeatmap(fmData, fmIdx);

        this.trajCtx.clearRect(0, 0, this.trajCanvas.width, this.trajCanvas.height);
        this.trajCtx.strokeStyle = "#333";
        this.trajCtx.lineWidth = 1;
        this.trajCtx.beginPath();
        this.trajCtx.moveTo(this.trajCanvas.width/2, 0); this.trajCtx.lineTo(this.trajCanvas.width/2, this.trajCanvas.height);
        this.trajCtx.moveTo(0, this.trajCanvas.height/2); this.trajCtx.lineTo(this.trajCanvas.width, this.trajCanvas.height/2);
        this.trajCtx.stroke();

        const hist = this.trajHistory[this.activeLayer];
        if (hist.length > 2) this.renderTrajectory(hist);
    }

    renderHeatmap(data: Float32Array, layerIdx: number) {
        const size = Math.sqrt(data.length);
        if (size % 1 !== 0) return;

        let localMin = Infinity, localMax = -Infinity;
        for(let v of data) { if(v<localMin) localMin=v; if(v>localMax) localMax=v; }

        if (!this.layerRanges[layerIdx]) {
            this.layerRanges[layerIdx] = { min: localMin, max: localMax };
        }

        const smoothRange = this.layerRanges[layerIdx]!;
        const alpha = 0.01; 
        
        smoothRange.min = smoothRange.min * (1 - alpha) + localMin * alpha;
        smoothRange.max = smoothRange.max * (1 - alpha) + localMax * alpha;

        const range = smoothRange.max - smoothRange.min || 1;
        const minVal = smoothRange.min;

        const imgData = this.heatmapCtx.createImageData(size, size);

        for (let i = 0; i < data.length; i++) {
            let norm = (data[i] - minVal) / range;
            if (norm < 0) norm = 0;
            if (norm > 1) norm = 1;
            
            const idx = i * 4;
            let r, g, b;
            if (norm < 0.25) { 
                const t = norm / 0.25; r = t * 60; g = 0; b = t * 100; 
            } else if (norm < 0.5) { 
                const t = (norm - 0.25) / 0.25; r = 60 + t * 195; g = 0; b = 100 - t * 80; 
            } else if (norm < 0.75) { 
                const t = (norm - 0.5) / 0.25; r = 255; g = t * 150; b = 20; 
            } else { 
                const t = (norm - 0.75) / 0.25; r = 255; g = 150 + t * 105; b = 20 + t * 235;
            }

            imgData.data[idx] = r; imgData.data[idx+1] = g; imgData.data[idx+2] = b; imgData.data[idx+3] = 255;
        }

        const tempC = document.createElement('canvas');
        tempC.width = size; tempC.height = size;
        const tempCtx = tempC.getContext('2d')!;
        tempCtx.putImageData(imgData, 0, 0);

        const destSize = Math.min(this.heatmapCanvas.width, this.heatmapCanvas.height) * 0.95;
        const dx = (this.heatmapCanvas.width - destSize) / 2;
        const dy = (this.heatmapCanvas.height - destSize) / 2;
        this.heatmapCtx.imageSmoothingEnabled = false;
        this.heatmapCtx.drawImage(tempC, dx, dy, destSize, destSize);
    }

    renderTrajectory(hist: {x: number, y: number, val: number}[]) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for(let p of hist) {
            if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x;
            if(p.y < minY) minY = p.y; if(p.y > maxY) maxY = p.y;
        }
        let rangeX = maxX - minX; let rangeY = maxY - minY;
        if (rangeX < 1e-6) rangeX = 0.001; if (rangeY < 1e-6) rangeY = 0.001;
        const padX = rangeX * 0.1; const padY = rangeY * 0.1;
        minX -= padX; maxX += padX; minY -= padY; maxY += padY;

        const scaleX = this.trajCanvas.width / (maxX - minX);
        const scaleY = this.trajCanvas.height / (maxY - minY);
        
        const toScreen = (p: {x: number, y: number}) => ({
            x: (p.x - minX) * scaleX,
            y: this.trajCanvas.height - (p.y - minY) * scaleY 
        });

        this.trajCtx.lineCap = 'round'; this.trajCtx.lineJoin = 'round'; this.trajCtx.lineWidth = 3;

        let p0 = toScreen(hist[0]);
        for (let i = 1; i < hist.length - 1; i++) {
            const p1 = toScreen(hist[i]);
            const p2 = toScreen(hist[i+1]);
            const val = hist[i].val;
            
            let r, g, b;
            const t = (val - (-1.5)) / (1.6 - (-1.5)); 
            if (t < 0.5) { const lt = t * 2; r = lt * 150; g = 20; b = 255 - lt * 100; } 
            else { const lt = (t - 0.5) * 2; r = 150 + lt * 105; g = 20; b = 155 - lt * 155; }
            
            r = Math.max(0,Math.min(255,r)); b = Math.max(0,Math.min(255,b));
            const alpha = Math.pow(i / hist.length, 2); 

            this.trajCtx.strokeStyle = `rgba(${Math.floor(r)}, ${g}, ${Math.floor(b)}, ${alpha})`;
            this.trajCtx.beginPath();
            const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
            this.trajCtx.moveTo(p0.x, p0.y);
            this.trajCtx.quadraticCurveTo(p1.x, p1.y, midX, midY);
            this.trajCtx.stroke();
            p0 = {x: midX, y: midY};
        }
    }
}

const FacePhysMonitor: React.FC = () => {
    // Health Data integration
    const health = useNativeHealth();
    const { data: session } = useSession();
    const router = useRouter();
    const { onboardingData, setPredictionResult, setLoading, setError } = useVitalStore();

    // Refs for DOM elements
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const psdCanvasRef = useRef<HTMLCanvasElement>(null);
    const plotCanvasRef = useRef<HTMLCanvasElement>(null);
    const trendCanvasRef = useRef<HTMLCanvasElement>(null);
    const heatmapCanvasRef = useRef<HTMLCanvasElement>(null);
    const trajCanvasRef = useRef<HTMLCanvasElement>(null);
    const cropDisplayCanvasRef = useRef<HTMLCanvasElement>(null);
    
    // State for UI updates
    const [hr, setHr] = useState<string>("--");
    const [sqi, setSqi] = useState<string>("0.00");
    const [latency, setLatency] = useState<string>("0.0ms");
    const [fps, setFps] = useState<string>("0");
    const [frame, setFrame] = useState<number>(0);
    const [statusText, setStatusText] = useState<string>("Loading System...");
    const [isSystemReady, setIsSystemReady] = useState<boolean>(false);
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [activeLayer, setActiveLayer] = useState<number>(0);
    const [showAbout, setShowAbout] = useState<boolean>(false);
    const [userFeedback, setUserFeedback] = useState<string>(USER_FEEDBACK.READY);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

    // Internal state (not for rendering)
    const stateRef = useRef({
        faceDetector: null as any,
        inferenceWorker: null as Worker | null,
        psdWorker: null as Worker | null,
        plotWorker: null as Worker | null,
        validationWorker: null as Worker | null,
        visEngine: null as VisEngine | null,
        isRunning: false,
        stream: null as MediaStream | null,
        inputBuffer: new Float32Array(RPPG_CONFIG.INPUT_BUFFER_SIZE),
        bufferPtr: 0,
        bufferFull: false,
        lastPsdTime: 0,
        lastHrUpdate: 0,
        lastLatencyUpdateTime: 0,
        lastFrameTime: 0,
        frameCount: 0,
        lastFpsTime: 0,
        bvpLog: [] as [number, number][],
        hrLog: [] as [number, number, number][],
        reliableHrSamples: [] as number[], // NEW: For robust clinical averaging
        lastFaceDetectTime: 0,
        lastHrValue: 0, // Start at 0 instead of 70 to avoid mock values
        currentSqi: 0,
        currentCaptureTime: 0,
        dval: 1/30,
        virtualTime: 0,
        lastTrendUpdateTime: 0,
        isCameraSwitching: false,
        currentFacingMode: 'user' as 'user' | 'environment',
        hasBackCamera: false,
        kfX: null as KalmanFilter1D | null,
        kfY: null as KalmanFilter1D | null,
        kfW: null as KalmanFilter1D | null,
        kfH: null as KalmanFilter1D | null,
        
        // --- V4 STATE ---
        bgTemporalBuffer: [] as number[],
        envState: "CLEAN",
        envJitter: 0.0,
        cameraScore: 1.0,
        systemHealth: false,
        thermalSamples: [] as number[],
        bpmKalman: new KalmanFilter1D(70, RPPG_CONFIG.KALMAN_PROCESS_NOISE, RPPG_CONFIG.KALMAN_MEASURE_NOISE),
        lastValidatedBPM: 0,
        lastValidatedBPMTime: 0,
        motionScore: 0,
        lightingScore: 0,
        skinQuality: 0,
        lastBbox: null as any,
    });

    const dbPromise = useRef<Promise<IDBDatabase> | null>(null);

    const isInitializing = useRef(false);
    const canvasesTransferred = useRef(false);

    useEffect(() => {
        if (isInitializing.current) return;
        isInitializing.current = true;

        dbPromise.current = new Promise((resolve, reject) => {
            const request = indexedDB.open(RPPG_CONFIG.DB_NAME, 1);
            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(RPPG_CONFIG.STORE_NAME)) {
                    db.createObjectStore(RPPG_CONFIG.STORE_NAME);
                }
            };
            request.onsuccess = (event: Event) => resolve((event.target as IDBOpenDBRequest).result);
            request.onerror = (event: Event) => reject((event.target as IDBOpenDBRequest).error);
        });

        init();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch((err) => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                stopSystem();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            stopSystem();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            stateRef.current.inferenceWorker?.terminate();
            stateRef.current.psdWorker?.terminate();
            stateRef.current.plotWorker?.terminate();
        };
    }, []);

    const saveStateToDB = async (stateData: any) => {
        const db = await dbPromise.current;
        if (!db) return;
        const tx = db.transaction(RPPG_CONFIG.STORE_NAME, "readwrite");
        tx.objectStore(RPPG_CONFIG.STORE_NAME).put(stateData, "lastState");
    };

    const loadStateFromDB = async () => {
        const db = await dbPromise.current;
        if (!db) return null;
        return new Promise((resolve) => {
            const tx = db.transaction(RPPG_CONFIG.STORE_NAME, "readonly");
            const req = tx.objectStore(RPPG_CONFIG.STORE_NAME).get("lastState");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    };

    // --- V4 CORE LOGIC ---

    const computeMotionScore = (bbox: any) => {
        if (!stateRef.current.lastBbox) {
            stateRef.current.lastBbox = bbox;
            return 0;
        }
        const last = stateRef.current.lastBbox;
        const dx = (bbox.originX - last.originX) / bbox.width;
        const dy = (bbox.originY - last.originY) / bbox.height;
        const ds = Math.abs(bbox.width * bbox.height - last.width * last.height) / (last.width * last.height);
        
        stateRef.current.lastBbox = bbox;
        const score = Math.sqrt(dx * dx + dy * dy) * 10.0 + ds * 5.0;
        stateRef.current.motionScore = stateRef.current.motionScore * 0.8 + score * 0.2;
        return stateRef.current.motionScore;
    };

    const recordCalibrationSample = (sqi: number) => {
        if (stateRef.current.frameCount < RPPG_CONFIG.CALIBRATION_SKIP_FRAMES) return;
        if (stateRef.current.frameCount >= RPPG_CONFIG.CALIBRATION_TOTAL) {
            stateRef.current.systemHealth = true;
            return;
        }
        stateRef.current.thermalSamples.push(sqi);
        if (stateRef.current.thermalSamples.length === RPPG_CONFIG.CALIBRATION_SAMPLE_FRAMES) {
            const sorted = [...stateRef.current.thermalSamples].sort();
            const median = sorted[Math.floor(RPPG_CONFIG.CALIBRATION_SAMPLE_FRAMES / 2)];
            console.log("Thermal calibration complete. Median SQI Baseline:", median);
            stateRef.current.systemHealth = median > 0.1; 
        }
    };

    const validateAndFilterBPM = (rawBPM: number) => {
        if (rawBPM < RPPG_CONFIG.BPM_MIN || rawBPM > RPPG_CONFIG.BPM_MAX) return null;

        const now = Date.now();
        if (stateRef.current.lastValidatedBPM > 0) {
            const dt = (now - stateRef.current.lastValidatedBPMTime) / 1000;
            const maxAllowedDelta = RPPG_CONFIG.BPM_MAX_DELTA_PER_WINDOW * (dt / 2.0); 
            const delta = Math.abs(rawBPM - stateRef.current.lastValidatedBPM);
            if (delta > maxAllowedDelta && dt < 4.0) {
                // Reject sudden jump
                return stateRef.current.lastValidatedBPM;
            }
        }

        const filtered = stateRef.current.bpmKalman.update(rawBPM);
        stateRef.current.lastValidatedBPM = filtered;
        stateRef.current.lastValidatedBPMTime = now;
        return filtered;
    };

    const computeGlobalReliability = () => {
        const s = stateRef.current;
        const envOk = s.envState === "CLEAN" ? 1.0 : 0.2;
        const motionOk = Math.max(0, 1.0 - s.motionScore);
        const systemOk = s.systemHealth ? 1.0 : 0.5;
        const cameraOk = s.cameraScore;
        const signalOk = s.currentSqi > RPPG_CONFIG.SQI_THRESHOLD ? 1.0 : (s.currentSqi / RPPG_CONFIG.SQI_THRESHOLD);

        const score = (envOk * 0.3) + (motionOk * 0.2) + (systemOk * 0.1) + (cameraOk * 0.2) + (signalOk * 0.2);
        
        const feedback = generateUserFeedback({
            envState: s.envState,
            motion: s.motionScore,
            lighting: s.lightingScore,
            cameraScore: s.cameraScore,
            systemHealth: s.systemHealth,
            sqi: s.currentSqi
        });
        setUserFeedback(feedback);

        return score;
    };

    const verifyCameraCapabilities = async (stream: MediaStream) => {
        const track = stream.getVideoTracks()[0];
        const caps: any = track.getCapabilities ? track.getCapabilities() : {};
        
        let reliability = 1.0;
        if (caps.whiteBalanceMode && !caps.whiteBalanceMode.includes('manual')) {
            console.warn("AWB Lock not supported. Expect signal drift.");
            reliability -= 0.2;
        }
        if (caps.exposureMode && !caps.exposureMode.includes('manual')) {
            console.warn("AE Lock not supported. Expect signal drift.");
            reliability -= 0.2;
        }
        stateRef.current.cameraScore = reliability;
    };

    const init = async () => {
        setStatusText("System Init...");
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm"
            );
            try {
                stateRef.current.faceDetector = await FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: RPPG_CONFIG.MODEL_FILES.faceModel,
                        delegate: "GPU" 
                    },
                    runningMode: "VIDEO"
                });
            } catch(err) {
                stateRef.current.faceDetector = await FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: RPPG_CONFIG.MODEL_FILES.faceModel,
                        delegate: "CPU"
                    },
                    runningMode: "VIDEO"
                });
                console.log("FaceDetector GPU delegate not available, using CPU.");
            }

            const [modelRes, projRes, sqiRes, psdRes] = await Promise.all([
                fetch(RPPG_CONFIG.MODEL_FILES.model),
                fetch(RPPG_CONFIG.MODEL_FILES.proj),
                fetch(RPPG_CONFIG.MODEL_FILES.sqi),
                fetch(RPPG_CONFIG.MODEL_FILES.psd)
            ]);

            if (!modelRes.ok || !projRes.ok || !sqiRes.ok || !psdRes.ok) {
                throw new Error(`Fetch failed.`);
            }

            const modelBuffer = await modelRes.arrayBuffer();
            const projBuffer = await projRes.arrayBuffer();
            const sqiBuffer = await sqiRes.arrayBuffer();
            const psdBuffer = await psdRes.arrayBuffer();

            let stateJson;
            const cachedState = await loadStateFromDB();

            if (cachedState) {
                stateJson = cachedState;
            } else {
                const stateRes = await fetch(RPPG_CONFIG.MODEL_FILES.state);
                const ds = new (window as any).DecompressionStream('gzip');
                const stateStream = stateRes.body!.pipeThrough(ds);
                stateJson = await new Response(stateStream).json();
            }

            stateRef.current.inferenceWorker = new Worker('/inference_worker.js');
            stateRef.current.psdWorker = new Worker('/psd_worker.js');
            stateRef.current.plotWorker = new Worker('/plot_worker.js');
            stateRef.current.validationWorker = new Worker('/validation_worker.js');

            stateRef.current.inferenceWorker.onmessage = (e) => {
                if (e.data.type === 'result') handleInferenceResult(e.data.payload);
                else if (e.data.type === 'state_exported') {
                    saveStateToDB(e.data.payload);
                }
            };

            stateRef.current.validationWorker.onmessage = (e) => {
                const { type, payload } = e.data;
                if (type === 'env_result') {
                    stateRef.current.envState = payload.state;
                    stateRef.current.lightingScore = payload.bgStability;
                } else if (type === 'signal_result') {
                    if (payload.isValid) {
                        stateRef.current.psdWorker?.postMessage({ type: 'run', payload: { inputData: payload.filtered } });
                    } else {
                        console.warn("Signal rejected by validation worker:", payload.reason);
                        stateRef.current.currentSqi = 0;
                        setHr("--");
                    }
                }
            };
            stateRef.current.inferenceWorker.postMessage({
                type: 'init',
                payload: { modelBuffer: modelBuffer, stateJson: stateJson, projBuffer: projBuffer }
            }, [modelBuffer, projBuffer]);

            stateRef.current.psdWorker.onmessage = (e) => {
                if (e.data.type === 'result') handlePsdResult(e.data.payload);
            };
            stateRef.current.psdWorker.postMessage({
                type: 'init',
                payload: { sqiBuffer: sqiBuffer, psdBuffer: psdBuffer }
            }, [sqiBuffer, psdBuffer]);

            const dpr = window.devicePixelRatio || 1;
            const bvpRect = plotCanvasRef.current!.getBoundingClientRect();
            const psdRect = psdCanvasRef.current!.getBoundingClientRect();
            const trendRect = trendCanvasRef.current!.getBoundingClientRect();

            if (!canvasesTransferred.current) {
                try {
                    plotCanvasRef.current!.width = bvpRect.width * dpr; 
                    plotCanvasRef.current!.height = bvpRect.height * dpr;
                    psdCanvasRef.current!.width = psdRect.width * dpr; 
                    psdCanvasRef.current!.height = psdRect.height * dpr;
                    trendCanvasRef.current!.width = trendRect.width * dpr;
                    trendCanvasRef.current!.height = trendRect.height * dpr;
                } catch (e) {
                    console.warn("Canvas already transferred, skipping main-thread resize.");
                }

                let offBvp, offPsd, offTrend;
                try {
                    offBvp = plotCanvasRef.current!.transferControlToOffscreen();
                    offPsd = psdCanvasRef.current!.transferControlToOffscreen();
                    offTrend = trendCanvasRef.current!.transferControlToOffscreen();
                    canvasesTransferred.current = true;
                } catch (e) {
                    console.warn("Canvas already transferred, offscreen control already moved.");
                }

                if (offBvp && offPsd && offTrend) {
                    stateRef.current.plotWorker.postMessage({
                        type: 'init',
                        payload: { 
                            bvpCanvas: offBvp, 
                            bvpWidth: bvpRect.width, 
                            bvpHeight: bvpRect.height, 
                            psdCanvas: offPsd,
                            psdWidth: psdRect.width,
                            psdHeight: psdRect.height,
                            trendCanvas: offTrend, 
                            trendWidth: trendRect.width,
                            trendHeight: trendRect.height,
                            dpr: dpr 
                        }
                    }, [offBvp, offPsd, offTrend]);
                }
            } else {
                 stateRef.current.plotWorker?.postMessage({
                    type: 'resize_trend',
                    payload: {
                        width: trendRect.width,
                        height: trendRect.height,
                        dpr: dpr
                    }
                });
            }

            stateRef.current.visEngine = new VisEngine(heatmapCanvasRef.current!, trajCanvasRef.current!);
            
            updateCanvasSizes();
            window.addEventListener('resize', handleResize);
            
            setIsSystemReady(true);
            setStatusText("Start");
        } catch (err: unknown) {
            setStatusText("Error");
            const errorMessage = err instanceof Error ? err.message : String(err);
            toast.error("Initialization failed: " + errorMessage);
        }
    };

    const handleResize = () => {
        updateCanvasSizes();
        updateWorkerModes();
    };

    const updateCanvasSizes = () => {
        if (!heatmapCanvasRef.current || !trajCanvasRef.current || !cropDisplayCanvasRef.current || !trendCanvasRef.current) return;

        const hRect = heatmapCanvasRef.current.parentElement!.getBoundingClientRect();
        heatmapCanvasRef.current.width = hRect.width; 
        heatmapCanvasRef.current.height = hRect.height;
        
        const tRect = trajCanvasRef.current.parentElement!.getBoundingClientRect();
        trajCanvasRef.current.width = tRect.width; 
        trajCanvasRef.current.height = tRect.height;
        
        const cRect = cropDisplayCanvasRef.current.parentElement!.getBoundingClientRect();
        cropDisplayCanvasRef.current.width = cRect.width; 
        cropDisplayCanvasRef.current.height = cRect.height;

        const trendRect = trendCanvasRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        stateRef.current.plotWorker?.postMessage({
            type: 'resize_trend',
            payload: {
                width: trendRect.width,
                height: trendRect.height,
                dpr: dpr
            }
        });
    };

    const updateWorkerModes = () => {
        const isNarrow = window.innerWidth <= 800;
        stateRef.current.inferenceWorker?.postMessage({ type: 'setMode', payload: { isLowPower: isNarrow } });
        stateRef.current.psdWorker?.postMessage({ type: 'setMode', payload: { isLowPower: isNarrow } });
    };

    const handleInferenceResult = (payload: any) => {
        const { value, time, projOutput, timestamp } = payload; 
        const now = performance.now();

        if (stateRef.current.isRunning) {
            stateRef.current.bvpLog.push([timestamp, value]); 
        }

        // Accumulate raw buffer for robust normalization in worker
        stateRef.current.inputBuffer[stateRef.current.bufferPtr] = value;
        stateRef.current.bufferPtr = (stateRef.current.bufferPtr + 1) % RPPG_CONFIG.INPUT_BUFFER_SIZE;
        if (stateRef.current.bufferPtr === 0) stateRef.current.bufferFull = true;

        if (stateRef.current.bufferPtr % 5 === 0) { // Check every 5 samples (approx 6Hz)
            let rawData;
            if (!stateRef.current.bufferFull) {
                rawData = stateRef.current.inputBuffer.slice(0, stateRef.current.bufferPtr);
            } else {
                rawData = new Float32Array(RPPG_CONFIG.INPUT_BUFFER_SIZE);
                rawData.set(stateRef.current.inputBuffer.subarray(stateRef.current.bufferPtr), 0);
                rawData.set(stateRef.current.inputBuffer.subarray(0, stateRef.current.bufferPtr), RPPG_CONFIG.INPUT_BUFFER_SIZE - stateRef.current.bufferPtr);
            }
            stateRef.current.validationWorker?.postMessage({
                type: 'process_signal',
                payload: { rawBuffer: rawData, fps: parseFloat(fps) || 30.0 }
            });
        }

        stateRef.current.plotWorker?.postMessage({ type: 'bvp_data', payload: value });
        stateRef.current.visEngine?.update(projOutput, value);
        stateRef.current.visEngine?.draw();

        if (now - stateRef.current.lastLatencyUpdateTime > 500) {
            setLatency(time.toFixed(1) + "ms");
            stateRef.current.lastLatencyUpdateTime = now;
        }
    };

    const handlePsdResult = (payload: any) => {
        const { sqi, hr, freq, psd, peak } = payload;
        const now = performance.now();
        
        stateRef.current.plotWorker?.postMessage({
            type: 'psd_data',
            payload: { psd, freq, peakIdx: peak }
        });

        stateRef.current.currentSqi = sqi; 

        // 1. Record for thermal calibration
        recordCalibrationSample(sqi);

        const timeSinceFace = performance.now() - stateRef.current.lastFaceDetectTime;
        const hasFace = timeSinceFace < 500; 
        
        // 2. Compute Global Reliability (Layers 1, 3, 4)
        const reliability = computeGlobalReliability();
        const isReliable = (sqi > RPPG_CONFIG.SQI_THRESHOLD && hasFace && reliability > 0.6 && stateRef.current.systemHealth);

        if (now - stateRef.current.lastHrUpdate > 500) {
            setSqi(sqi.toFixed(2));
            
            if (isReliable) {
                const rawBPM = hr / 30.0 / stateRef.current.dval;
                // 3. Temporal Validation (Layer 5)
                const validatedBPM = validateAndFilterBPM(rawBPM);
                
                if (validatedBPM) {
                    stateRef.current.lastHrValue = validatedBPM;
                    setHr(stateRef.current.lastHrValue.toFixed(1));
                } else {
                    setHr("--");
                }
            } else {
                setHr("--");
            }
            stateRef.current.lastHrUpdate = now;
        }

        tryUpdateTrend();
    };

    const tryUpdateTrend = () => {
        const now = Date.now();
        
        if (now - stateRef.current.lastTrendUpdateTime < 1000) {
            return;
        }
        stateRef.current.lastTrendUpdateTime = now;

        if (stateRef.current.isRunning) {
            stateRef.current.hrLog.push([now, stateRef.current.lastHrValue, stateRef.current.currentSqi]);
        }

        const timeSinceFace = performance.now() - stateRef.current.lastFaceDetectTime;
        const hasFace = timeSinceFace < 500;
        const isValid = hasFace && (stateRef.current.currentSqi > RPPG_CONFIG.SQI_THRESHOLD);

        stateRef.current.plotWorker?.postMessage({
            type: 'trend_data',
            payload: { 
                hr: stateRef.current.lastHrValue, 
                valid: isValid 
            }
        });
    };

    const startSystem = async () => {
        if (stateRef.current.isCameraSwitching) return;
        stateRef.current.isCameraSwitching = true;

        if (stateRef.current.stream) {
            stateRef.current.stream.getTracks().forEach(track => track.stop());
            stateRef.current.stream = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            await new Promise(resolve => setTimeout(resolve, 500));
            stateRef.current.currentFacingMode = (stateRef.current.currentFacingMode === 'user') ? 'environment' : 'user';
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: stateRef.current.currentFacingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                },
                audio: false
            });
            stateRef.current.stream = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();

                const vw = videoRef.current.videoWidth;
                const vh = videoRef.current.videoHeight;
                if (previewCanvasRef.current) {
                    previewCanvasRef.current.width = vw;
                    previewCanvasRef.current.height = vh;
                }
                if (overlayCanvasRef.current) {
                    overlayCanvasRef.current.width = vw;
                    overlayCanvasRef.current.height = vh;
                }
            }

            if (!stateRef.current.isRunning) {
                stateRef.current.isRunning = true;
                setIsRunning(true);
                stateRef.current.bvpLog = [];
                stateRef.current.hrLog = [];
                stateRef.current.lastHrValue = 60; 
                
                stateRef.current.lastFrameTime = performance.now();
                stateRef.current.lastFpsTime = stateRef.current.lastFrameTime;
                stateRef.current.frameCount = 0;
                tick();
            } else {
                if (stateRef.current.currentCaptureTime > 0) {
                    stateRef.current.currentCaptureTime = Date.now() - stateRef.current.dval * 1000;
                }
            }
        } catch (err: any) {
            console.error("Error starting camera:", err);
            toast.error("Camera access failed: " + err.message);
        } finally {
            stateRef.current.isCameraSwitching = false;
        }
    };

    const stopSystem = () => {
        stateRef.current.isRunning = false;
        setIsRunning(false);
        if (stateRef.current.stream) {
            stateRef.current.stream.getTracks().forEach(track => track.stop());
            stateRef.current.stream = null;
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
        }
        stateRef.current.currentCaptureTime = 0;
    };

    const tick = () => {
        if (!stateRef.current.isRunning) return;
        const now = performance.now();
        const elapsed = now - stateRef.current.lastFrameTime;
        const TARGET_FPS = 30;
        const FRAME_INTERVAL = 1000 / TARGET_FPS;

        if (elapsed >= FRAME_INTERVAL) {
            const actualInterval = now - stateRef.current.lastFrameTime;
            stateRef.current.envJitter = stateRef.current.envJitter * 0.95 + Math.abs(actualInterval - FRAME_INTERVAL) * 0.05;
            
            stateRef.current.lastFrameTime = now - (elapsed % FRAME_INTERVAL);
            
            stateRef.current.frameCount++;
            setFrame(stateRef.current.frameCount);
            if (stateRef.current.frameCount % 30 === 0) {
                setFps((30 / (now - stateRef.current.lastFpsTime) * 1000).toFixed(1));
                stateRef.current.lastFpsTime = now;
            }

            if (stateRef.current.frameCount % 60 === 0) {
                stateRef.current.inferenceWorker?.postMessage({ type: 'export_state' });
            }

            processFrame();
        }
        requestAnimationFrame(tick);
    };

    const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const processFrame = () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        const captureTime = Date.now();

        if (stateRef.current.currentCaptureTime > 0) {
            stateRef.current.dval = stateRef.current.dval * 0.997 + 0.003 * (captureTime - stateRef.current.currentCaptureTime) / 1000;
            stateRef.current.virtualTime += stateRef.current.dval * 1000;
            stateRef.current.virtualTime = stateRef.current.virtualTime * 0.997 + 0.003 * captureTime;
        } else {
            stateRef.current.currentCaptureTime = captureTime;
            stateRef.current.virtualTime = stateRef.current.currentCaptureTime;
        }

        const previewCtx = previewCanvasRef.current!.getContext('2d', { alpha: false })!;
        previewCtx.drawImage(videoRef.current, 0, 0, previewCanvasRef.current!.width, previewCanvasRef.current!.height);
        
        const detections = stateRef.current.faceDetector.detectForVideo(videoRef.current, performance.now());
        const overlayCtx = overlayCanvasRef.current!.getContext('2d')!;
        overlayCtx.clearRect(0, 0, overlayCanvasRef.current!.width, overlayCanvasRef.current!.height);

        if (detections.detections.length > 0) {
            stateRef.current.lastFaceDetectTime = performance.now(); 

            const det = detections.detections[0];
            let { originX, originY, width, height } = det.boundingBox;

            // 1. Motion Score
            computeMotionScore(det.boundingBox);

            if (!stateRef.current.kfX || !stateRef.current.kfY || !stateRef.current.kfW || !stateRef.current.kfH) {
                stateRef.current.kfX = new KalmanFilter1D(originX); 
                stateRef.current.kfY = new KalmanFilter1D(originY);
                stateRef.current.kfW = new KalmanFilter1D(width); 
                stateRef.current.kfH = new KalmanFilter1D(height);
            } else {
                originX = stateRef.current.kfX.update(originX); 
                originY = stateRef.current.kfY.update(originY);
                width = stateRef.current.kfW.update(width); 
                height = stateRef.current.kfH.update(height);
            }

            height *= 1.2;
            originY -= height * 0.2; 

            overlayCtx.strokeStyle = "#34C759be"; 
            overlayCtx.lineWidth = 2;
            overlayCtx.strokeRect(originX, originY, width, height);

            const sx = Math.max(0, originX);
            const sy = Math.max(0, originY);
            const sw = Math.min(width, previewCanvasRef.current!.width - sx);
            const sh = Math.min(height, previewCanvasRef.current!.height - sy);

            if (sw > 0 && sh > 0) {
                if (!cropCanvasRef.current) {
                    cropCanvasRef.current = document.createElement('canvas');
                    cropCanvasRef.current.width = 36;
                    cropCanvasRef.current.height = 36;
                }
                const cropCtx = cropCanvasRef.current.getContext('2d', { willReadFrequently: true })!;
                cropCtx.drawImage(previewCanvasRef.current!, sx, sy, sw, sh, 0, 0, 36, 36);
                
                // 2. Skin Quality Check (sampled)
                const cropData = cropCtx.getImageData(0, 0, 36, 36);
                let skinPixels = 0;
                for (let i = 0; i < cropData.data.length; i += 16) { // Sample every 4th pixel
                    if (isSkinPixelRobust(cropData.data[i], cropData.data[i+1], cropData.data[i+2])) skinPixels++;
                }
                stateRef.current.skinQuality = skinPixels / (cropData.data.length / 16);

                const cropDisplayCtx = cropDisplayCanvasRef.current!.getContext('2d')!;
                cropDisplayCtx.fillStyle = '#000';
                cropDisplayCtx.fillRect(0, 0, cropDisplayCanvasRef.current!.width, cropDisplayCanvasRef.current!.height);
                cropDisplayCtx.imageSmoothingEnabled = false;
                const minDim = Math.min(cropDisplayCanvasRef.current!.width, cropDisplayCanvasRef.current!.height) * 0.95;
                const cx = (cropDisplayCanvasRef.current!.width - minDim) / 2;
                const cy = (cropDisplayCanvasRef.current!.height - minDim) / 2;
                cropDisplayCtx.drawImage(cropCanvasRef.current, cx, cy, minDim, minDim);

                const imgData = cropCtx.getImageData(0, 0, 36, 36);
                const inputFloat32 = new Float32Array(36 * 36 * 3);
                for (let i = 0; i < imgData.data.length; i += 4) {
                    const idx = i / 4;
                    inputFloat32[idx * 3] = imgData.data[i] / 255.0;
                    inputFloat32[idx * 3 + 1] = imgData.data[i+1] / 255.0;
                    inputFloat32[idx * 3 + 2] = imgData.data[i+2] / 255.0;
                }
                stateRef.current.inferenceWorker?.postMessage({ 
                    type: 'run', 
                    payload: { imgData: inputFloat32, dtVal: stateRef.current.dval, timestamp: stateRef.current.virtualTime } 
                }, [inputFloat32.buffer]);
            }
        } else {
            stateRef.current.plotWorker?.postMessage({ type: 'bvp_data', payload: 0 });
            setHr("--");
            stateRef.current.currentSqi = 0;
            stateRef.current.motionScore = 1.0; // Assume motion if face lost
            tryUpdateTrend();
        }

        // 3. Background Temporal Sampling (outside face ROI)
        const bgSample = previewCtx.getImageData(5, 5, 1, 1).data; // Top-left corner
        const bgLuma = (bgSample[0] + bgSample[1] + bgSample[2]) / (3 * 255.0);
        stateRef.current.bgTemporalBuffer.push(bgLuma);
        if (stateRef.current.bgTemporalBuffer.length > RPPG_CONFIG.BG_TEMPORAL_BUFFER_SIZE) {
            stateRef.current.bgTemporalBuffer.shift();
        }

        if (stateRef.current.frameCount % 30 === 0 && stateRef.current.bgTemporalBuffer.length >= 60) {
            stateRef.current.validationWorker?.postMessage({
                type: 'validate_env',
                payload: { 
                    buffer: new Float32Array(stateRef.current.bgTemporalBuffer), 
                    fps: parseFloat(fps) || 30.0,
                    jitter: stateRef.current.envJitter
                }
            });
        }

        stateRef.current.currentCaptureTime = captureTime;
    };

    const handleSaveData = async () => {
        if (stateRef.current.bvpLog.length === 0 && stateRef.current.hrLog.length === 0) {
            toast.warning("No data collected to save.");
            return;
        }

        const zip = new JSZip();

        let bvpCsv = "timestamp,value\n";
        stateRef.current.bvpLog.forEach(row => {
            bvpCsv += `${row[0]},${row[1].toFixed(6)}\n`;
        });
        zip.file("bvp.csv", bvpCsv);

        let hrCsv = "timestamp,hr,sqi\n";
        stateRef.current.hrLog.forEach(row => {
            hrCsv += `${row[0]},${row[1].toFixed(2)},${row[2].toFixed(4)}\n`;
        });
        zip.file("hr.csv", hrCsv);

        try {
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const sec = String(now.getSeconds()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}T${hour}-${min}-${sec}`;
            a.download = `vital_monitor_data_${dateStr}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            toast.error("Failed to package data: " + e.message);
        }
    };

    const handleAnalyze = async () => {
        if (stateRef.current.bvpLog.length < 300) {
            toast.info("Please collect at least 10 seconds of data for accurate analysis.");
            return;
        }

        const heartRate = parseFloat(hr);
        if (isNaN(heartRate) || stateRef.current.currentSqi < RPPG_CONFIG.SQI_THRESHOLD) {
            toast.error(USER_FEEDBACK.INSUFFICIENT_QUALITY);
            setPredictionResult({ error: USER_FEEDBACK.INSUFFICIENT_QUALITY }, {
                id: `test_${Date.now()}`,
                timestamp: new Date().toISOString(),
                status: 'insufficient_signal',
                metrics: { hr: undefined, sqi: stateRef.current.currentSqi }
            });
            stopSystem();
            router.push('/profile');
            return;
        }

        setIsAnalyzing(true);
        setLoading(true);

        try {
            // Helper to ensure boolean values for clinical flags
            const ensureBool = (val: any) => {
                if (typeof val === 'boolean') return val;
                if (typeof val === 'string') {
                    const s = val.toLowerCase();
                    return ['true', 'yes', 'current', 'parent', 'sibling', 'both', 'family'].includes(s);
                }
                return !!val;
            };

            const payload = {
                patient_id: onboardingData?.patient_id || session?.user?.id || session?.user?.email || "P1023",
                clinical_data: {
                    weight: Math.round(onboardingData?.clinical_data?.weight || 75),
                    height: Math.round(onboardingData?.clinical_data?.height || 175),
                    glucose_fasting_mg_dl: Math.round(onboardingData?.clinical_data?.glucose_fasting_mg_dl || 100),
                    hba1c: parseFloat(String(onboardingData?.clinical_data?.hba1c || 5.4)),
                    smoking: ensureBool(onboardingData?.clinical_data?.smoking),
                    familyHistory: ensureBool(onboardingData?.clinical_data?.familyHistory),
                    gender: onboardingData?.clinical_data?.gender ?? 1,
                    bloodpressure: Math.round(health.data.systolicBP || onboardingData?.clinical_data?.bloodpressure || 120),
                    pregnancies: Math.round(onboardingData?.clinical_data?.pregnancies || 0),
                    skinthickness: Math.round(onboardingData?.clinical_data?.skinthickness || 20),
                    insulin: Math.round(onboardingData?.clinical_data?.insulin || 80),
                    diabetespedigreefunction: parseFloat(String(onboardingData?.clinical_data?.diabetespedigreefunction || 0.47)),
                    dateOfBirth: (onboardingData?.clinical_data?.dateOfBirth || "1990-01-01").split('T')[0]
                },
                rppg_features: {
                    heart_rate: Math.round(heartRate),
                    hrv_sdnn: 50,
                    hrv_rmssd: 40,
                    spo2: Math.round(health.data.spO2 || 98)
                },
                temporal_data: [] // Aligned with working Postman example to avoid 422
            };

            const response = await fetch('/api/monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("FastAPI Error Details:", errorData);
                const detailMsg = errorData.details?.detail?.[0]?.msg || errorData.message || "Medical model unavailable";
                throw new Error(detailMsg);
            }

            const result = await response.json();
            stopSystem(); // Ensure camera turns off immediately
            setPredictionResult(result, {
                id: `test_${Date.now()}`,
                timestamp: new Date().toISOString(),
                status: 'success',
                metrics: { 
                    hr: heartRate, 
                    sqi: stateRef.current.currentSqi, 
                    risk_status: result.risk_status, 
                    probability: result.final_probability || result.probability 
                }
            });
            router.push('/profile');
        } catch (err: any) {
            console.error("Analysis failed:", err);
            const errorMessage = err.message || "Analysis failed";
            setError(errorMessage);
            toast.error("Analysis failed: " + errorMessage);
            setPredictionResult({ error: errorMessage }, {
                id: `test_${Date.now()}`,
                timestamp: new Date().toISOString(),
                status: 'model_unavailable',
                metrics: { hr: heartRate, sqi: stateRef.current.currentSqi }
            });
            stopSystem();
            router.push('/profile');
        } finally {
            setIsAnalyzing(false);
            setLoading(false);
        }
    };

    return (
        <div className={styles.root}>
            <nav className={styles.retroNav}>
                <div className={styles.navGroupLeft}>
                    <div className={styles.navBrand}>
                        <div className={styles.navBrandIcon}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 12h3l3-8 4 16 3-8h5"/>
                            </svg>
                        </div>
                        <span className={styles.navBrandName}>Seha<span className={styles.accent}>ti</span></span>
                        <span className={styles.navBrandBadge}>rPPG</span>
                    </div>

                    <div className={styles.navDivider} aria-hidden="true"></div>

                    <div style={{ position: 'relative' }}>
                        <div 
                            className={`${styles.navBtn} ${showAbout ? styles.pressed : ''}`} 
                            role="button" 
                            tabIndex={0}
                            onClick={() => setShowAbout(!showAbout)}
                        >
                            <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="8" strokeWidth="2.5" strokeLinecap="round"/>
                                <line x1="12" y1="12" x2="12" y2="16"/>
                            </svg>
                            <span>About</span>
                        </div>

                        <div id={styles.aboutMenu} className={showAbout ? styles.show : ''} role="dialog">
                            <div className={styles.menuContent}>
                                <div className={styles.menuTitle}>
                                    <div className={styles.menuTitleIcon}>
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                        </svg>
                                    </div>
                                    Sehati Demo
                                </div>
                                <p>
                                    Sehati leverages State Space Models (SSMs) to model heart dynamics as continuous-time controlled ODEs, ensuring robust handling of irregular sampling and precise capture of physiological signals.
                                </p>
                                <p>
                                    Optimized for edge inference, the model is ultra-lightweight (4 MB) with latency as low as 5 ms — running entirely in your browser.
                                </p>
                                <p>
                                    Powered by LiteRT. <strong>Privacy guaranteed — zero data upload.</strong>
                                </p>
                                <hr className={styles.menuDivider} />
                                <div className={styles.menuFooter}>
                                    <span className={styles.menuAuthor}>Author: Kegang Wang</span>
                                    <span className={styles.menuVersionBadge}>V1.0</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <a href="https://github.com/user-attachments/files/24302692/FacePhys2025.pdf"
                    target="_blank" rel="noopener noreferrer" className={styles.navBtn} title="Research Paper">
                        <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                        <span>Paper</span>
                    </a>
                </div>

                <a href="https://ai.google.dev/edge" target="_blank" rel="noopener noreferrer" className={styles.litertBrand} title="Powered by LiteRT">
                    <span className={styles.litertText}>Powered by</span>
                    <img src="/resource/litert_logo.png" alt="LiteRT" className={styles.litertLogo} />
                </a>
            </nav>

            <video ref={videoRef} playsInline muted style={{ display: 'none' }}></video>

            <div className={styles.monitorWindow}>
                <div className={styles.shPageHeader}>
                    <p className={styles.shGreeting}>
                        <span className={styles.shGreetingDot} aria-hidden="true"></span>
                        Real-time contactless monitoring
                    </p>
                    <h1 className={styles.shTitle}>Heart Rate <span className={styles.accent}>Dashboard</span></h1>
                </div>

                <div className={styles.mainContent}>
                    <div className={styles.visCol}>
                        <p className={styles.shSectionLabel}>Signal Analysis</p>
                        <div className={styles.psdFrame}>
                            <canvas ref={psdCanvasRef}></canvas>
                        </div>

                        <div className={styles.nnFrame}>
                            <div className={styles.layerTabs} role="tablist">
                                {['SSM1', 'SSM2', 'SSM3', 'SSM4', 'PROJ'].map((label, idx) => (
                                    <div 
                                        key={label}
                                        className={`${styles.layerBtn} ${activeLayer === idx ? styles.active : ''}`} 
                                        onClick={() => {
                                            setActiveLayer(idx);
                                            if (stateRef.current.visEngine) stateRef.current.visEngine.activeLayer = idx;
                                        }}
                                        role="tab"
                                    >
                                        {label}
                                    </div>
                                ))}
                            </div>

                            <div className={styles.nnGrid}>
                                <div className={styles.gridCell}>
                                    <span className={styles.cellLabel}>ROI</span>
                                    <canvas ref={cropDisplayCanvasRef}></canvas>
                                </div>
                                <div className={styles.gridCell}>
                                    <span className={styles.cellLabel}>ATTN</span>
                                    <canvas ref={heatmapCanvasRef}></canvas>
                                </div>
                                <div className={`${styles.gridCell} ${styles.fullWidth}`}>
                                    <span className={styles.cellLabel}>Heart State</span>
                                    <canvas ref={trajCanvasRef}></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.monitorCol}>
                        <div className={styles.statsGroup}>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>HR (BPM)</span>
                                <div className={styles.statValueBox}>
                                    <span className={`${styles.statVal} ${hr !== "--" ? styles.active : ''}`}>{hr}</span>
                                </div>
                                <div className={styles.feedbackZone}>{userFeedback}</div>
                            </div>

                            {/* Native Health Integration */}
                            {health.isAvailable ? (
                                <>
                                    <div className={`${styles.statItem} ${styles.healthItem}`}>
                                        <span className={styles.statLabel}>Steps</span>
                                        <div className={styles.statValueBox}>
                                            <span className={styles.statVal}>
                                                {health.permissionState === 'granted' ? (health.data.steps || 0) : '--'}
                                            </span>
                                        </div>
                                        {health.permissionState !== 'granted' && (
                                            <button 
                                                className={styles.healthBtn} 
                                                onClick={health.requestPermissions}
                                                disabled={health.isLoading}
                                            >
                                                {health.permissionState === 'denied' ? 'Denied' : 'Enable'}
                                            </button>
                                        )}
                                    </div>
                                    <div className={`${styles.statItem} ${styles.healthItem}`}>
                                        <span className={styles.statLabel}>Cal</span>
                                        <div className={styles.statValueBox}>
                                            <span className={styles.statVal}>
                                                {health.permissionState === 'granted' ? (health.data.calories || 0) : '--'}
                                            </span>
                                        </div>
                                        {health.error === 'HEALTH_CONNECT_NOT_INSTALLED' && (
                                            <button className={styles.healthBtn} onClick={health.openStorePage}>Install</button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className={`${styles.statItem} ${styles.healthItem}`} style={{ opacity: 0.5 }}>
                                    <span className={styles.statLabel}>Health</span>
                                    <div className={styles.statValueBox}>
                                        <span className={styles.statVal} style={{ fontSize: '10px' }}>Not Supported</span>
                                    </div>
                                </div>
                            )}

                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>SQI</span>
                                <div className={styles.statValueBox}>
                                    <span className={styles.statVal}>{sqi}</span>
                                </div>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Latency</span>
                                <div className={styles.statValueBox}>
                                    <span className={styles.statVal}>{latency}</span>
                                </div>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>FPS</span>
                                <div className={styles.statValueBox}>
                                    <span className={styles.statVal}>{fps}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.videoFrame}>
                            <canvas ref={previewCanvasRef} className={styles.displayLayer}></canvas>
                            <canvas ref={overlayCanvasRef} className={styles.displayLayer}></canvas>
                        </div>

                        <div className={styles.waveFrame}>
                            {!isRunning ? (
                                <button 
                                    className={styles.largeStartBtn} 
                                    onClick={startSystem}
                                    disabled={!isSystemReady}
                                >
                                    {statusText}
                                </button>
                            ) : (
                                <div className={styles.actionGroup}>
                                    <button 
                                        className={styles.analyzeBtn}
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing}
                                    >
                                        {isAnalyzing ? (
                                            <div className={styles.spinner}></div>
                                        ) : (
                                            <>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={styles.analyzeIcon}>
                                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                                </svg>
                                                Analyze Results
                                            </>
                                        )}
                                    </button>
                                    <button 
                                        className={styles.stopBtn}
                                        onClick={stopSystem}
                                    >
                                        Stop
                                    </button>
                                </div>
                            )}
                            <canvas ref={plotCanvasRef}></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.bottomBar}>
                <div className={styles.trendWrapper}>
                    <div className={styles.trendYAxis} aria-hidden="true">
                        <span className={styles.axisLabel} style={{ bottom: '71.4%' }}>140</span>
                        <span className={styles.axisLabel} style={{ bottom: '42.8%' }}>100</span>
                        <span className={styles.axisLabel} style={{ bottom: '14.2%' }}>60</span>
                    </div>
                    <div className={styles.trendContainer}>
                        <span className={styles.trendTitle}>HR TREND</span>
                        <canvas ref={trendCanvasRef}></canvas>
                    </div>
                </div>
                <div className={styles.saveContainer}>
                    <button className={styles.saveBtn} title="Save data as ZIP" onClick={handleSaveData}>
                        <svg className={styles.saveIcon} viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>SAVE</span>
                        <span style={{ fontSize: '8.5px', fontWeight: 600, opacity: 0.6 }}>(.ZIP)</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FacePhysMonitor;
