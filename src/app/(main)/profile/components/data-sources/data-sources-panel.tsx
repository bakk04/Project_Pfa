'use client'

import React from 'react'
import { useHealthStore } from '@/services/healthStore'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import styles from './DataSources.module.css'

export function DataSourcesPanel() {
  const isAvailable = useHealthStore((state) => state.isAvailable)
  const connectedSources = isAvailable ? ['Capacitor Health Bridge'] : []
  const { isSyncing, lastSyncTime, syncError, triggerSync } = useSyncStatus()

  const availableSources = ['Google Health', 'Samsung Health', 'Apple Health', 'Manual Input']
  const unconnectedSources = availableSources.filter((source) => !connectedSources.includes(source))

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Data Sources</h3>

      {/* Connected Sources */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Connected</p>
        {connectedSources.length > 0 ? (
          <div className={styles.sourceList}>
            {connectedSources.map((source) => (
              <div key={source} className={styles.connectedItem}>
                <span className={styles.sourceName}>{source}</span>
                <div className={styles.statusWrapper}>
                  <span className={styles.statusText}>Active</span>
                  <div className={styles.statusDot} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No sources connected</p>
          </div>
        )}
      </div>

      {/* Sync Status */}
      <div className={styles.section}>
        <button
          onClick={triggerSync}
          disabled={isSyncing}
          className={styles.syncButton}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
        {lastSyncTime && (
          <p className={styles.syncInfo}>
            Last sync: {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {syncError && (
          <div className={styles.errorBox}>
            {syncError}
          </div>
        )}
      </div>

      {/* Available Sources to Connect */}
      {unconnectedSources.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Available</p>
          <div className={styles.sourceList}>
            {unconnectedSources.map((source) => (
              <div key={source} className={styles.availableItem}>
                <span className={styles.sourceName}>{source}</span>
                <div className={styles.statusWrapper}>
                  <span className={styles.connectText}>Connect</span>
                  <div className={styles.inactiveDot} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
