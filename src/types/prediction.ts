export interface ClinicalData {
  age: number;
  bloodPressure: { systolic: number; diastolic: number };
  glucose: number; // mg/dL
  bmi: number;
  familyHistory: boolean;
  smoking: boolean;
  physicalActivity: boolean;
  dietQuality: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface ClinicalFlags {
  highGlucose: boolean; // > 126 mg/dL
  hypertension: boolean; // systolic > 140
  highBMI: boolean; // > 30
  sedentary: boolean;
  poorDiet: boolean;
}

export interface DiabetesPrediction {
  probability: number; // 0-1 (0-100%)
  hasDiabetesRisk: boolean;
  uncertainty: number; // confidence interval width
  clinicalFlags: ClinicalFlags;
  riskLevel: 'low' | 'moderate' | 'high';
  recommendedActions: string[];
  timestamp: Date;
}

export interface PredictionHistory {
  predictions: DiabetesPrediction[];
  maxEntries: number;
}

export interface AIStore {
  currentPrediction: DiabetesPrediction | null;
  predictionHistory: DiabetesPrediction[];
  messages: ChatMessage[];
  addPrediction: (prediction: DiabetesPrediction) => void;
  getPrediction: () => DiabetesPrediction | null;
  getPredictionHistory: () => DiabetesPrediction[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
