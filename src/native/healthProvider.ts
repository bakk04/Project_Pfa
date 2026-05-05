import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { 
  HealthProvider, 
  HealthData, 
  HealthResult, 
  HealthPermissionState, 
  HealthError 
} from '../services/healthTypes';

const DEBUG_HEALTH = true;

export class NativeHealthProvider implements HealthProvider {
  private log(message: string, ...args: any[]) {
    if (DEBUG_HEALTH) {
      console.log(`[NativeHealthProvider] ${message}`, ...args);
    }
  }

  async isAvailable(): Promise<HealthResult<boolean>> {
    if (!Capacitor.isNativePlatform()) {
      return { success: false, error: 'DEVICE_NOT_SUPPORTED' };
    }
    try {
      const check = await Health.isAvailable();
      this.log('Availability check:', check);
      
      if (!check.available && check.reason === 'Health Connect not installed') {
        return { success: false, error: 'HEALTH_CONNECT_NOT_INSTALLED' };
      }
      
      return { success: true, data: check.available };
    } catch (error) {
      this.log('Error checking availability:', error);
      return { success: false, error: 'UNKNOWN_ERROR' };
    }
  }

  async checkPermissions(): Promise<HealthPermissionState> {
    try {
      const status = await Health.checkAuthorization({
        read: ['heartRate', 'steps', 'calories'],
      });
      this.log('Permission status:', status);
      
      const allGranted = ['heartRate', 'steps', 'calories'].every(type => 
        status.readAuthorized.includes(type as any)
      );

      if (allGranted) return 'granted';
      if (status.readDenied.length > 0) return 'denied';
      return 'unknown';
    } catch (error) {
      this.log('Error checking permissions:', error);
      return 'unknown';
    }
  }

  async requestPermissions(): Promise<HealthPermissionState> {
    try {
      this.log('Requesting permissions...');
      const status = await Health.requestAuthorization({
        read: ['heartRate', 'steps', 'calories'],
        write: [],
      });
      
      const allGranted = ['heartRate', 'steps', 'calories'].every(type => 
        status.readAuthorized.includes(type as any)
      );

      return allGranted ? 'granted' : 'denied';
    } catch (error) {
      this.log('Error requesting permissions:', error);
      return 'denied';
    }
  }

  async getTodaySummary(): Promise<HealthResult<HealthData>> {
    try {
      const now = new Date();
      const startTime = new Date();
      startTime.setHours(0, 0, 0, 0);

      // Fetch heart rate (last sample)
      const hrResult = await Health.readSamples({
        dataType: 'heartRate',
        startDate: new Date(now.getTime() - 3600000).toISOString(), // Last hour
        endDate: now.toISOString(),
        limit: 1,
      });

      // Fetch aggregated steps and calories
      const [stepsResult, calResult] = await Promise.all([
        Health.queryAggregated({
          dataType: 'steps',
          startDate: startTime.toISOString(),
          endDate: now.toISOString(),
          bucket: 'day',
        }),
        Health.queryAggregated({
          dataType: 'calories',
          startDate: startTime.toISOString(),
          endDate: now.toISOString(),
          bucket: 'day',
        })
      ]);

      const data: HealthData = {
        heartRate: hrResult.samples[0]?.value || null,
        steps: stepsResult.samples[0]?.value || 0,
        calories: calResult.samples[0]?.value || 0,
        timestamp: Date.now(),
      };

      this.log('Fetched data:', data);
      return { success: true, data };
    } catch (error: any) {
      this.log('Error fetching data:', error);
      if (error.message?.includes('Permission')) {
        return { success: false, error: 'PERMISSION_DENIED' };
      }
      return { success: false, error: 'NO_DATA' };
    }
  }

  async openStorePage(): Promise<void> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await Health.openHealthConnectSettings();
      } catch (error) {
        this.log('Error opening Health Connect settings:', error);
      }
    }
  }
}
