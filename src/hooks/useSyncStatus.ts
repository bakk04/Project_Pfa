import { useCallback, useRef } from 'react'
import { useHealthStore } from '@/services/healthStore'

const SYNC_THROTTLE_MS = 60000 // 1 minute

export function useSyncStatus() {
  const isSyncing = useHealthStore((state) => state.isLoading)
  const data = useHealthStore((state) => state.data)
  const syncError = useHealthStore((state) => state.error)
  const fetchData = useHealthStore((state) => state.fetchData)

  const lastSyncRef = useRef<number>(0)

  const canSync = useCallback(() => {
    const now = Date.now()
    return now - lastSyncRef.current >= SYNC_THROTTLE_MS
  }, [])

  const triggerSync = useCallback(async () => {
    if (!canSync()) {
      // We don't have setSyncError in the new store, but we can handle it locally if needed
      // For now, let's just proceed or log
      console.warn('Sync throttled')
      return
    }

    lastSyncRef.current = Date.now()
    await fetchData(true)
  }, [canSync, fetchData])

  return {
    isSyncing,
    lastSyncTime: new Date(data.timestamp),
    syncError,
    canSync,
    triggerSync,
  }
}
