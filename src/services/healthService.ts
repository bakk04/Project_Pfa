import { Capacitor } from '@capacitor/core';
import { 
  HealthProvider, 
  HealthData, 
  HealthResult, 
  HealthPermissionState 
} from './healthTypes';
import { NativeHealthProvider } from '../native/healthProvider';
import { WebHealthProvider } from './webHealthProvider';

const FETCH_INTERVAL = 10000; // 10 seconds throttling

class HealthService {
  private provider: HealthProvider;
  private lastFetchTime: number = 0;
  private cache: HealthData | null = null;

  constructor() {
    if (Capacitor.isNativePlatform()) {
      this.provider = new NativeHealthProvider();
    } else {
      this.provider = new WebHealthProvider();
    }
  }

  async isAvailable(): Promise<HealthResult<boolean>> {
    return this.provider.isAvailable();
  }

  async checkPermissions(): Promise<HealthPermissionState> {
    return this.provider.checkPermissions();
  }

  async requestPermissions(): Promise<HealthPermissionState> {
    return this.provider.requestPermissions();
  }

  async getTodaySummary(force: boolean = false): Promise<HealthResult<HealthData>> {
    const now = Date.now();
    
    // Throttling & Caching logic
    if (!force && this.cache && (now - this.lastFetchTime < FETCH_INTERVAL)) {
      console.log('[HealthService] Returning cached data');
      return { success: true, data: this.cache };
    }

    const result = await this.provider.getTodaySummary();
    
    if (result.success && result.data) {
      this.cache = result.data;
      this.lastFetchTime = now;
    }

    return result;
  }

  async openStorePage(): Promise<void> {
    if (this.provider.openStorePage) {
      await this.provider.openStorePage();
    }
  }
}

export const healthService = new HealthService();
