export type HealthPermissionState = 'granted' | 'denied' | 'unknown' | 'not_installed';

export type HealthError =
  | 'PERMISSION_DENIED'
  | 'NO_DATA'
  | 'DEVICE_NOT_SUPPORTED'
  | 'HEALTH_CONNECT_NOT_INSTALLED'
  | 'UNKNOWN_ERROR';

export interface HealthData {
  heartRate: number | null;
  steps: number;
  calories: number;
  spO2?: number;
  systolicBP?: number;
  diastolicBP?: number;
  temperature?: number;
  respiratoryRate?: number;
  timestamp: number;
}

export interface HealthHistory {
  heartRate: { value: number; timestamp: number }[];
  steps: { value: number; timestamp: number }[];
  calories: { value: number; timestamp: number }[];
  spO2: { value: number; timestamp: number }[];
  bloodPressure: { systolic: number; diastolic: number; timestamp: number }[];
}

export interface HealthResult<T> {
  success: boolean;
  data?: T;
  error?: HealthError;
}

export interface HealthProvider {
  isAvailable(): Promise<HealthResult<boolean>>;
  checkPermissions(): Promise<HealthPermissionState>;
  requestPermissions(): Promise<HealthPermissionState>;
  getTodaySummary(): Promise<HealthResult<HealthData>>;
  openStorePage?(): Promise<void>;
}
