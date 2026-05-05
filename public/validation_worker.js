/**
 * validation_worker.js
 * Specialized worker for environmental validation and signal pre-processing (v4).
 */

// --- UTILS & MATH ---

function computeAlias(fSignal, fS) {
    return fS / 2 - Math.abs((fSignal % fS) - fS / 2);
}

function computeAliasBand(fSignal, fSNominal, jitterFPS) {
    const fCenter = computeAlias(fSignal, fSNominal);
    const aliasLow = computeAlias(fSignal, fSNominal - jitterFPS);
    const aliasHigh = computeAlias(fSignal, fSNominal + jitterFPS);

    const rawMin = Math.min(fCenter, aliasLow, aliasHigh);
    const rawMax = Math.max(fCenter, aliasLow, aliasHigh);
    const margin = (rawMax - rawMin) * 0.20;

    return {
        fCenter,
        fMin: Math.max(0, rawMin - margin),
        fMax: rawMax + margin,
    };
}

function integratePowerBand(fftResult, fMin, fMax, freqResolution) {
    const binMin = fMin / freqResolution;
    const binMax = fMax / freqResolution;
    let power = 0;

    for (let b = Math.floor(binMin); b <= Math.ceil(binMax); b++) {
        if (b < 0 || b >= fftResult.length) continue;
        const binStart = b;
        const binEnd = b + 1;
        const overlap = Math.min(binEnd, binMax) - Math.max(binStart, binMin);
        const fraction = Math.max(0, overlap);
        power += (fftResult[b] ?? 0) * fraction;
    }
    return power;
}

/**
 * Simple FFT implementation (Radix-2 Cooley-Tukey)
 * Assumes N is a power of 2.
 */
function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        let ang = 2 * Math.PI / len;
        let wlen_re = Math.cos(ang);
        let wlen_im = Math.sin(ang);
        for (let i = 0; i < n; i += len) {
            let w_re = 1;
            let w_im = 0;
            for (let j = 0; j < len / 2; j++) {
                let u_re = re[i + j];
                let u_im = im[i + j];
                let v_re = re[i + j + len / 2] * w_re - im[i + j + len / 2] * w_im;
                let v_im = re[i + j + len / 2] * w_im + im[i + j + len / 2] * w_re;
                re[i + j] = u_re + v_re;
                im[i + j] = u_im + v_im;
                re[i + j + len / 2] = u_re - v_re;
                im[i + j + len / 2] = u_im - v_im;
                let tmp_re = w_re * wlen_re - w_im * wlen_im;
                w_im = w_re * wlen_im + w_im * wlen_re;
                w_re = tmp_re;
            }
        }
    }
}

function computeFFTPower(buffer) {
    const N = buffer.length;
    // Find next power of 2
    let M = 1;
    while (M < N) M <<= 1;
    
    const re = new Float32Array(M);
    const im = new Float32Array(M);
    re.set(buffer);
    
    fft(re, im);
    
    const power = new Float32Array(M / 2);
    for (let i = 0; i < M / 2; i++) {
        power[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    }
    return power;
}

// --- CORE FUNCTIONS (from correction.md) ---

function detect60HzViaAutocorrelation(buffer, fSampling) {
    const N = buffer.length;
    const mu = buffer.reduce((a, b) => a + b, 0) / N;

    const centered = new Float32Array(N);
    for (let i = 0; i < N; i++) centered[i] = buffer[i] - mu;

    const varTotal = centered.reduce((acc, v) => acc + v * v, 0) / N;
    if (varTotal < 1e-10) return 0;

    const alias60 = computeAlias(60, fSampling);
    const targetLag = alias60 > 0.5
        ? Math.round(fSampling / alias60)
        : Math.round(fSampling / 2);

    const lagMin = Math.max(1, targetLag - 2);
    const lagMax = Math.min(N / 2, targetLag + 2);

    let peakAutoCorr = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {
        let sum = 0;
        for (let i = 0; i < N - lag; i++) sum += centered[i] * centered[i + lag];
        const r = (sum / (N - lag)) / varTotal;
        peakAutoCorr = Math.max(peakAutoCorr, Math.abs(r));
    }

    const nearbyLagMin = Math.max(1, targetLag - 8);
    const nearbyLagMax = Math.min(N / 2, targetLag + 8);
    let nearbyMean = 0;
    let nearbyCount = 0;
    for (let lag = nearbyLagMin; lag <= nearbyLagMax; lag++) {
        if (lag >= lagMin && lag <= lagMax) continue;
        let sum = 0;
        for (let i = 0; i < N - lag; i++) sum += centered[i] * centered[i + lag];
        nearbyMean += Math.abs((sum / (N - lag)) / varTotal);
        nearbyCount++;
    }
    nearbyMean /= Math.max(nearbyCount, 1);

    const selectivity = nearbyMean > 0.01 ? peakAutoCorr / nearbyMean : peakAutoCorr * 5;
    return Math.min(peakAutoCorr * 0.5 + (selectivity - 1) * 0.1, 1.0);
}

function detectAutoAdjustmentDrift(buffer) {
    const N = buffer.length;
    let drift = 0;
    for (let i = 1; i < N; i++) {
        drift += Math.abs(buffer[i] - buffer[i - 1]);
    }
    const avgDrift = drift / N;
    return Math.min(avgDrift / 0.02, 1.0);
}

function computeBackgroundStability(bgBuffer) {
    const mean = bgBuffer.reduce((a, b) => a + b, 0) / bgBuffer.length;
    let variance = 0;
    for (let v of bgBuffer) {
        variance += (v - mean) * (v - mean);
    }
    variance /= bgBuffer.length;
    return Math.min(variance / 0.005, 1.0);
}

function analyzeEnvironmentTemporal(buffer, sampleRateFPS, jitterFPS) {
    const N = buffer.length;
    const fftResult = computeFFTPower(buffer);
    const freqRes = sampleRateFPS / (fftResult.length * 2);

    const band50 = computeAliasBand(50, sampleRateFPS, jitterFPS);
    const band100 = computeAliasBand(100, sampleRateFPS, jitterFPS);

    const power50 = integratePowerBand(fftResult, band50.fMin, band50.fMax, freqRes);
    const power100 = integratePowerBand(fftResult, band100.fMin, band100.fMax, freqRes);

    const flicker50Power = power50 + power100 * 0.5;
    const flicker60Score = detect60HzViaAutocorrelation(buffer, sampleRateFPS);
    const autoAdjustScore = detectAutoAdjustmentDrift(buffer);
    const bgStability = computeBackgroundStability(buffer);

    let state = "CLEAN";
    const FLICKER_50_THRESHOLD = 5000.0; // Scaled for FFT power
    const FLICKER_60_THRESHOLD = 0.6;

    if (flicker50Power > FLICKER_50_THRESHOLD) state = "FLICKER_50HZ";
    else if (flicker60Score > FLICKER_60_THRESHOLD) state = "FLICKER_60HZ";
    else if (autoAdjustScore > 0.6) state = "AUTO_ADJUST_ACTIVE";
    else if (bgStability > 0.7) state = "UNSTABLE_LIGHTING";

    return {
        state,
        flicker50Power,
        flicker60Score,
        autoAdjustScore,
        bgStability
    };
}

// --- BIQUAD IIR ---

function designButterworthBandpass(fS, fLow, fHigh) {
    const nyq = fS / 2;
    const wLow = (fLow / nyq) * Math.PI;
    const wHigh = (fHigh / nyq) * Math.PI;
    const wCenter = Math.sqrt(wLow * wHigh);
    const Q = wCenter / (wHigh - wLow);
    const Kc = Math.tan(wCenter / 2);
    const bw = Kc / Q;
    const a0_inv = 1 / (1 + bw + Kc * Kc);

    const b = [bw * a0_inv, 0, -bw * a0_inv];
    const a = [1, 2 * (Kc * Kc - 1) * a0_inv, (1 - bw + Kc * Kc) * a0_inv];
    return { b, a };
}

let cachedBiquadFPS = -1;
let cachedBiquad = { b: [0, 0, 0], a: [1, 0, 0] };
const bpState = { x: [0, 0], y: [0, 0] };

function applyBandpassIIR(sample, currentFPS) {
    const drift = Math.abs(currentFPS - cachedBiquadFPS) / Math.max(cachedBiquadFPS, 1);
    if (cachedBiquadFPS < 0 || drift > 0.05) {
        cachedBiquad = designButterworthBandpass(currentFPS, 0.5, 3.0);
        cachedBiquadFPS = currentFPS;
    }
    const { b, a } = cachedBiquad;

    const out = b[0] * sample + b[1] * bpState.x[0] + b[2] * bpState.x[1] - a[1] * bpState.y[0] - a[2] * bpState.y[1];

    bpState.x[1] = bpState.x[0]; bpState.x[0] = sample;
    bpState.y[1] = bpState.y[0]; bpState.y[0] = out;
    return out;
}

// --- NORMALIZATION ---

function normalizeRPPGRobust(rawBuffer) {
    const N = rawBuffer.length;
    const sorted = new Float32Array(rawBuffer);
    sorted.sort();

    const med = N % 2 === 0 ? (sorted[N / 2 - 1] + sorted[N / 2]) / 2 : sorted[Math.floor(N / 2)];
    const deviations = new Float32Array(N);
    for (let i = 0; i < N; i++) deviations[i] = Math.abs(rawBuffer[i] - med);
    deviations.sort();

    const mad = N % 2 === 0 ? (deviations[N / 2 - 1] + deviations[N / 2]) / 2 : deviations[Math.floor(N / 2)];
    const output = new Float32Array(N);

    if (mad < 1e-8) {
        return { output, median: med, mad, valid: false };
    }

    const scale = 1.4826 * mad;
    for (let i = 0; i < N; i++) {
        output[i] = (rawBuffer[i] - med) / scale;
    }
    return { output, median: med, mad, valid: true };
}

function detectLowSignalAmplitude(buffer) {
    let max = -Infinity, min = Infinity;
    for (let v of buffer) {
        if (v > max) max = v;
        if (v < min) min = v;
    }
    return (max - min) < 0.01;
}

// --- WORKER MESSAGE HANDLER ---

self.onmessage = (e) => {
    const { type, payload } = e.data;

    if (type === 'validate_env') {
        const { buffer, fps, jitter } = payload;
        const result = analyzeEnvironmentTemporal(buffer, fps, jitter);
        self.postMessage({ type: 'env_result', payload: result });

    } else if (type === 'process_signal') {
        const { rawBuffer, fps } = payload;
        
        // 1. Robust Normalization
        const normResult = normalizeRPPGRobust(rawBuffer);
        
        // 2. SNR / Amplitude check
        const isLowAmplitude = detectLowSignalAmplitude(normResult.output);
        
        // 3. IIR Filtering (on normalized signal)
        const filtered = new Float32Array(normResult.output.length);
        for (let i = 0; i < normResult.output.length; i++) {
            filtered[i] = applyBandpassIIR(normResult.output[i], fps);
        }

        self.postMessage({ 
            type: 'signal_result', 
            payload: { 
                normalized: normResult.output,
                filtered: filtered,
                isValid: normResult.valid && !isLowAmplitude,
                reason: isLowAmplitude ? "LOW_SIGNAL_AMPLITUDE" : (normResult.valid ? null : "FLAT_SIGNAL")
            } 
        });
    }
};
