export interface ClinicalData {
  weight: number;
  height: number;
  glucose_fasting_mg_dl: number;
  hba1c: number;
  smoking: boolean;
  familyHistory: boolean;
  gender: number; // 0 for female, 1 for male
  bloodpressure: number;
  pregnancies: number;
  skinthickness: number;
  insulin: number;
  diabetespedigreefunction: number;
  dateOfBirth: string; // YYYY-MM-DD
}

export interface RppgFeatures {
  heart_rate: number;
  hrv_sdnn: number;
  hrv_rmssd: number;
  spo2: number;
}

export interface PredictionRequest {
  patient_id: string;
  clinical_data: ClinicalData;
  rppg_features: RppgFeatures;
  temporal_data: any[];
}

export interface DiabetesPrediction {
  risk_status: 'LOW' | 'MODERATE' | 'HIGH';
  final_probability: number; // The 1.0 or 0.857 in the example
  probability_ensemble?: number;
  probability_calibrated?: number;
  uncertainty: number;
  flags: string[];
  timestamp: string;
}

export interface PredictionHistory {
  predictions: DiabetesPrediction[];
  maxEntries: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
