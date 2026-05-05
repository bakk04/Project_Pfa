export interface Vitals {
  heartRate?: number; // bpm
  spO2?: number; // %
  systolicBP?: number; // mmHg
  diastolicBP?: number; // mmHg
  temperature?: number; // °C
  respiratoryRate?: number; // breaths per min
  lastUpdated?: Date;
}

export interface Activity {
  steps?: number;
  calories?: number;
  exerciseTime?: number; // minutes
  date?: Date;
}

export interface ManualInput {
  bloodPressure?: { systolic: number; diastolic: number };
  glucose?: number; // mg/dL
  weight?: number; // kg
  enteredAt?: Date;
}

export interface HealthDataState {
  vitals: Vitals;
  activity: Activity;
  manualInput: ManualInput;
  connectedSources: string[];
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
}

export interface DataSource {
  id: string;
  name: string;
  connected: boolean;
  lastSync?: Date;
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
}

export interface rPPGMeasurement {
  id: string;
  heartRate: number;
  signalQuality: number; // 0-100
  timestamp: Date;
  duration: number; // seconds
}

export interface rPPGResult {
  latestMeasurement?: rPPGMeasurement;
  history: rPPGMeasurement[];
  lastChecked?: Date;
}
