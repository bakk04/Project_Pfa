import { create } from 'zustand';
import { 
  HealthData, 
  HealthHistory, 
  HealthPermissionState, 
  HealthError 
} from './healthTypes';
import { healthService } from './healthService';

const MAX_HISTORY_LEN = 100;

interface HealthState {
  data: HealthData;
  history: HealthHistory;
  permissionState: HealthPermissionState;
  isAvailable: boolean;
  isLoading: boolean;
  error: HealthError | null;
  
  // Actions
  init: () => Promise<void>;
  fetchData: (force?: boolean) => Promise<void>;
  requestPermissions: () => Promise<void>;
  openStorePage: () => Promise<void>;
  updateVitals: (vitals: Partial<HealthData>) => void;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  data: {
    heartRate: null,
    steps: 0,
    calories: 0,
    timestamp: Date.now(),
  },
  history: {
    heartRate: [],
    steps: [],
    calories: [],
    spO2: [],
    bloodPressure: [],
  },
  permissionState: 'unknown',
  isAvailable: false,
  isLoading: false,
  error: null,

  init: async () => {
    set({ isLoading: true });
    const availableResult = await healthService.isAvailable();
    
    if (!availableResult.success) {
      set({ 
        isAvailable: false, 
        error: availableResult.error || 'DEVICE_NOT_SUPPORTED', 
        isLoading: false 
      });
      return;
    }

    const permission = await healthService.checkPermissions();
    set({ 
      isAvailable: true, 
      permissionState: permission, 
      isLoading: false 
    });

    if (permission === 'granted') {
      await get().fetchData();
    }
  },

  fetchData: async (force = false) => {
    const { permissionState, isAvailable } = get();
    if (!isAvailable || permissionState !== 'granted') return;

    set({ isLoading: true, error: null });
    const result = await healthService.getTodaySummary(force);

    if (result.success && result.data) {
      const newData = result.data;
      const { history } = get();

      // Update history with rolling buffer
      const updateHistory = <T,>(list: { value: T; timestamp: number }[], value: T, ts: number) => {
        const newList = [...(list || []), { value, timestamp: ts }];
        if (newList.length > MAX_HISTORY_LEN) newList.shift();
        return newList;
      };

      const updateBPHistory = (list: { systolic: number; diastolic: number; timestamp: number }[], s: number | undefined, d: number | undefined, ts: number) => {
        if (s === undefined || d === undefined) return list || [];
        const newList = [...(list || []), { systolic: s, diastolic: d, timestamp: ts }];
        if (newList.length > MAX_HISTORY_LEN) newList.shift();
        return newList;
      };

      set({
        data: newData,
        history: {
          heartRate: newData.heartRate !== null 
            ? updateHistory(history.heartRate, newData.heartRate, newData.timestamp) 
            : history.heartRate,
          steps: updateHistory(history.steps, newData.steps, newData.timestamp),
          calories: updateHistory(history.calories, newData.calories, newData.timestamp),
          spO2: newData.spO2 !== undefined
            ? updateHistory(history.spO2, newData.spO2, newData.timestamp)
            : history.spO2,
          bloodPressure: updateBPHistory(history.bloodPressure, newData.systolicBP, newData.diastolicBP, newData.timestamp),
        },
        isLoading: false,
      });
    } else {
      set({ error: result.error || 'NO_DATA', isLoading: false });
    }
  },

  requestPermissions: async () => {
    set({ isLoading: true });
    const state = await healthService.requestPermissions();
    set({ permissionState: state, isLoading: false });
    if (state === 'granted') {
      await get().fetchData(true);
    }
  },

  openStorePage: async () => {
    await healthService.openStorePage();
  },

  updateVitals: (vitals) => {
    const currentData = get().data;
    const newData = { ...currentData, ...vitals, timestamp: Date.now() };
    const { history } = get();

    const updateHistory = <T,>(list: { value: T; timestamp: number }[], value: T, ts: number) => {
      const newList = [...(list || []), { value, timestamp: ts }];
      if (newList.length > MAX_HISTORY_LEN) newList.shift();
      return newList;
    };

    const updateBPHistory = (list: { systolic: number; diastolic: number; timestamp: number }[], s: number | undefined, d: number | undefined, ts: number) => {
      if (s === undefined || d === undefined) return list || [];
      const newList = [...(list || []), { systolic: s, diastolic: d, timestamp: ts }];
      if (newList.length > MAX_HISTORY_LEN) newList.shift();
      return newList;
    };

    set({
      data: newData,
      history: {
        heartRate: newData.heartRate !== null 
          ? updateHistory(history.heartRate, newData.heartRate, newData.timestamp) 
          : history.heartRate,
        steps: updateHistory(history.steps, newData.steps, newData.timestamp),
        calories: updateHistory(history.calories, newData.calories, newData.timestamp),
        spO2: newData.spO2 !== undefined
          ? updateHistory(history.spO2, newData.spO2, newData.timestamp)
          : history.spO2,
        bloodPressure: updateBPHistory(history.bloodPressure, newData.systolicBP, newData.diastolicBP, newData.timestamp),
      }
    });
  }
}));
