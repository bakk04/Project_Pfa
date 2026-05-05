import { 
  HealthProvider, 
  HealthData, 
  HealthResult, 
  HealthPermissionState 
} from './healthTypes';

/**
 * WebHealthProvider - ZERO FAKE DATA POLICY
 * On web/non-native platforms, we do not have access to Google/Apple Health.
 * This provider returns NULL/ZERO and 'denied' to ensure no fake data is displayed.
 */
export class WebHealthProvider implements HealthProvider {
  async isAvailable(): Promise<HealthResult<boolean>> {
    // Health APIs are NOT available on standard web browsers
    return { success: true, data: false };
  }

  async checkPermissions(): Promise<HealthPermissionState> {
    return 'denied';
  }

  async requestPermissions(): Promise<HealthPermissionState> {
    return 'denied';
  }

  async getTodaySummary(): Promise<HealthResult<HealthData>> {
    // Return empty state. Real data only comes from Native Platform (Capacitor).
    const data: HealthData = {
      heartRate: null,
      steps: 0,
      calories: 0,
      timestamp: Date.now(),
    };
    return { success: true, data };
  }
}
