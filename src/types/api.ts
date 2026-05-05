import { DiabetesPrediction, ClinicalData, ChatMessage } from './prediction';

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: Date;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthSyncRequest {
  userID: string;
  sourcesToSync?: string[];
}

export interface HealthSyncResponse {
  synced: boolean;
  sources: string[];
  dataUpdated: boolean;
  nextSyncIn: number; // seconds
}

export interface HealthSourcesResponse {
  sources: Array<{
    id: string;
    name: string;
    connected: boolean;
    lastSync?: Date;
    status: string;
  }>;
}

export interface DiabetesPredictionRequest {
  clinicalData: ClinicalData;
  userID: string;
}

export interface DiabetesPredictionResponse {
  prediction: DiabetesPrediction;
  modelVersion: string;
  executionTime: number; // ms
}

export interface ChatRequest {
  message: string;
  userID: string;
  context?: {
    latestPrediction?: DiabetesPrediction;
    recentVitals?: Record<string, unknown>;
  };
}

export interface ChatResponse {
  message: ChatMessage;
  tokens: number;
  context?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}
