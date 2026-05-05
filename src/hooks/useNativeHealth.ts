import { useEffect, useCallback } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useHealthStore } from '../services/healthStore';

export const useNativeHealth = (refreshInterval = 30000) => {
  const { 
    data, 
    history,
    permissionState, 
    isAvailable, 
    isLoading, 
    error, 
    fetchData, 
    init, 
    requestPermissions,
    openStorePage
  } = useHealthStore();

  const sync = useCallback((force = false) => {
    if (document.visibilityState === 'visible') {
      fetchData(force);
    }
  }, [fetchData]);

  useEffect(() => {
    init();

    // App State handling for Native
    let appListener: any;
    if (Capacitor.isNativePlatform()) {
      appListener = App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('[useNativeHealth] App resumed, syncing...');
          sync(true);
        }
      });
    }

    // Visibility change for Web/PWA
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useNativeHealth] Tab visible, syncing...');
        sync(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (appListener) appListener.remove();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [init, sync]);

  // Periodic Refresh
  useEffect(() => {
    if (isAvailable && permissionState === 'granted') {
      const interval = setInterval(() => sync(), refreshInterval);
      return () => clearInterval(interval);
    }
  }, [isAvailable, permissionState, sync, refreshInterval]);

  return {
    data,
    history,
    permissionState,
    isAvailable,
    isLoading,
    error,
    requestPermissions,
    openStorePage,
    refresh: () => sync(true),
  };
};
