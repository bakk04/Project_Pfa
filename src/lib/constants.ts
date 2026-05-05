/**
 * Medical and Technical Constants for Sehati rPPG
 */

export const RPPG_CONFIG = {
  // Buffer and Signal Quality
  INPUT_BUFFER_SIZE: 450,
  SQI_THRESHOLD: 0.38,
  
  // Storage
  DB_NAME: "VitalMonitorDB",
  STORE_NAME: "states",
  
  // Model Assets
  MODEL_FILES: {
    model: '/models/model.tflite',
    proj: '/models/proj.tflite',
    sqi: '/models/sqi_model.tflite',
    psd: '/models/psd_model.tflite',
    state: '/models/state.gz',
    faceModel: "/models/blaze_face_short_range.tflite"
  },
  
  // Environment & Calibration
  BG_TEMPORAL_BUFFER_SIZE: 120, // 4 seconds at 30 FPS
  CALIBRATION_SKIP_FRAMES: 15,
  CALIBRATION_SAMPLE_FRAMES: 45,
  CALIBRATION_TOTAL: 60, // CALIBRATION_SKIP_FRAMES + CALIBRATION_SAMPLE_FRAMES
  
  // Physiological BPM Limits
  BPM_MIN: 30,
  BPM_MAX: 200,
  BPM_MAX_DELTA_PER_WINDOW: 15,
  
  // Kalman Filter Tuning
  KALMAN_PROCESS_NOISE: 2.0,
  KALMAN_MEASURE_NOISE: 8.0,
};

export const USER_FEEDBACK = {
  WARMING_UP: "System warming up...",
  CAMERA_UNRELIABLE: "Camera unreliable",
  LIGHTING_FLICKER_50HZ: "Unstable lighting (50Hz Flicker)",
  LIGHTING_FLICKER_60HZ: "Unstable lighting (60Hz Flicker)",
  AUTO_ADJUST: "Camera auto-adjusting...",
  UNSTABLE_LIGHTING: "Unstable lighting",
  STAY_STILL: "Please stay still",
  VARIABLE_LIGHTING: "Variable lighting detected",
  WEAK_SIGNAL: "Weak signal...",
  STABLE_SIGNAL: "Stable signal",
  READY: "Ready for diagnosis",
  INSUFFICIENT_QUALITY: "Insufficient signal quality. Please ensure good lighting and keep your face still.",
};
