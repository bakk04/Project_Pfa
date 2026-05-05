import { useCallback } from 'react'
import { useHealthStore } from '@/services/healthStore'
import type { HealthData } from '@/services/healthTypes'

export function useHealthData() {
  const data = useHealthStore((state) => state.data)
  const isSyncing = useHealthStore((state) => state.isLoading)
  const error = useHealthStore((state) => state.error)
  const fetchData = useHealthStore((state) => state.fetchData)
  const updateVitals = useHealthStore((state) => state.updateVitals)

  // Map to the old structure to minimize breaking changes in UI components
  const vitals = {
    heartRate: data.heartRate ?? undefined,
    spO2: data.spO2,
    systolicBP: data.systolicBP,
    diastolicBP: data.diastolicBP,
    temperature: data.temperature,
    respiratoryRate: data.respiratoryRate,
    lastUpdated: new Date(data.timestamp)
  }

  const activity = {
    steps: data.steps,
    calories: data.calories,
    exerciseTime: 0,
    date: new Date(data.timestamp)
  }

  const triggerSync = useCallback(async () => {
    // First, try to sync from backend to get any persisted data
    try {
      await fetch('/api/health/sync', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      // Then, fetch from local native provider (the source of truth)
      await fetchData(true)
    } catch (err) {
      console.error('[useHealthData] Sync error:', err)
      await fetchData(true)
    }
  }, [fetchData])

  return {
    vitals,
    activity,
    isSyncing,
    lastSyncTime: new Date(data.timestamp),
    syncError: error,
    updateVitals,
    triggerSync,
  }
}
