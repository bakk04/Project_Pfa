'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useHealthStore } from '@/services/healthStore'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { GlassCard } from '../shared/GlassCard'
import { cn } from '@/lib/utils'
import { 
  Link2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Plus,
  Smartphone,
  Watch,
  Activity,
  Keyboard
} from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  }
}

const SOURCE_CONFIG: Record<string, { icon: typeof Smartphone; color: string; desc: string }> = {
  'Google Health': { icon: Smartphone, color: '#4285F4', desc: 'Google Fit integration via OAuth 2.0' },
  'Samsung Health': { icon: Watch, color: '#1428A0', desc: 'Samsung Health SDK bridge' },
  'Apple Health': { icon: Activity, color: '#007AFF', desc: 'HealthKit native data access' },
  'Manual Input': { icon: Keyboard, color: '#34C759', desc: 'Direct clinical data entry' },
  'Capacitor Health Bridge': { icon: Smartphone, color: '#34C759', desc: 'Native health data bridge' },
}

const ALL_SOURCES = ['Google Health', 'Samsung Health', 'Apple Health', 'Manual Input']

export function SourcesTab() {
  const isAvailable = useHealthStore((state) => state.isAvailable)
  const connectedSources = isAvailable ? ['Capacitor Health Bridge'] : []
  const { isSyncing, lastSyncTime, syncError, triggerSync } = useSyncStatus()

  const unconnectedSources = ALL_SOURCES.filter((s) => !connectedSources.includes(s))

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-sh-card flex items-center justify-center shadow-sh">
          <Link2 className="w-6 h-6 text-sh-green" />
        </div>
        <div>
          <h2 className="text-[22px] font-bold text-sh-text">Data Sources</h2>
          <p className="text-sm font-bold text-sh-sub">Synchronize your clinical ecosystem</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Connected Sources */}
        <motion.div variants={itemVariants} className="lg:col-span-5">
          <GlassCard className="h-full">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-[22px] h-[22px] text-sh-green" />
              <h3 className="text-[13px] font-bold text-sh-sub uppercase tracking-wider">
                Active Integrations
              </h3>
            </div>
            <p className="text-[15px] font-bold text-sh-text mb-6">
              {connectedSources.length > 0
                ? `${connectedSources.length} source${connectedSources.length > 1 ? 's' : ''} connected`
                : 'No sources connected yet'}
            </p>

            {connectedSources.length > 0 ? (
              <div className="space-y-4">
                {connectedSources.map((source) => {
                  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG['Manual Input']
                  const Icon = cfg.icon
                  return (
                    <div 
                      key={source} 
                      className="flex items-center gap-4 p-4 bg-sh-bg rounded-[24px]"
                    >
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cfg.color}15` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-sh-text">{source}</p>
                        <p className="text-[13px] font-medium text-sh-sub">{cfg.desc}</p>
                      </div>
                      <span className={cn(
                        'px-4 py-1.5 rounded-full text-[12px] font-bold',
                        'bg-sh-green/10 text-sh-green'
                      )}>
                        Active
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-[24px] bg-sh-bg flex items-center justify-center mb-4">
                  <Link2 className="w-8 h-8 text-sh-sub/50" />
                </div>
                <p className="text-[15px] font-bold text-sh-text mb-1">No sources connected yet.</p>
                <p className="text-[13px] font-medium text-sh-sub">Connect a source from available options.</p>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Sync Control */}
        <motion.div variants={itemVariants} className="lg:col-span-4">
          <GlassCard className="h-full">
            <div className="flex items-center gap-3 mb-6">
              <RefreshCw className="w-[22px] h-[22px] text-sh-green" />
              <h3 className="text-[13px] font-bold text-sh-sub uppercase tracking-wider">
                Sync Control
              </h3>
            </div>

            <button
              onClick={triggerSync}
              disabled={isSyncing}
              className={cn(
                'w-full py-4 rounded-[24px] mb-4',
                'bg-sh-green shadow-lg shadow-sh-green/20',
                'text-white font-bold text-[15px]',
                'hover:shadow-xl hover:shadow-sh-green/30 hover:scale-[1.02]',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100',
                'transition-all duration-300 active:scale-95',
                'flex items-center justify-center gap-3'
              )}
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Sync Now
                </>
              )}
            </button>

            {lastSyncTime && (
              <div className="flex items-center gap-4 p-4 bg-sh-bg rounded-[24px] mb-4">
                <div className="w-12 h-12 rounded-2xl bg-sh-card flex items-center justify-center shadow-sm">
                  <Clock className="w-6 h-6 text-sh-green" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-sh-text">Last Sync</p>
                  <p className="text-[13px] font-medium text-sh-sub">
                    {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}

            {syncError && (
              <div className="flex items-start gap-4 p-4 bg-sh-red/10 rounded-[24px]">
                <AlertCircle className="w-[22px] h-[22px] text-sh-red flex-shrink-0 mt-0.5" />
                <p className="text-[14px] font-bold text-sh-red leading-snug">{syncError}</p>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Available Sources */}
        <motion.div variants={itemVariants} className="lg:col-span-3">
          <GlassCard className="h-full">
            <div className="flex items-center gap-3 mb-6">
              <Plus className="w-[22px] h-[22px] text-sh-green" />
              <h3 className="text-[13px] font-bold text-sh-sub uppercase tracking-wider">
                Available
              </h3>
            </div>

            {unconnectedSources.length > 0 ? (
              <div className="space-y-3">
                {unconnectedSources.map((source) => {
                  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG['Manual Input']
                  const Icon = cfg.icon
                  return (
                    <div 
                      key={source} 
                      className="flex items-center gap-4 p-3.5 bg-sh-bg rounded-[20px] hover:bg-sh-border/50 transition-colors"
                    >
                      <div 
                        className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cfg.color}15` }}
                      >
                        <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                      </div>
                      <span className="flex-1 text-[15px] font-bold text-sh-text">
                        {source}
                      </span>
                      <button
                        onClick={(e) => e.preventDefault()}
                        className={cn(
                          'px-4 py-2 rounded-[16px] text-[13px] font-bold',
                          'bg-sh-card shadow-sm text-sh-green',
                          'hover:shadow-md transition-all active:scale-95'
                        )}
                      >
                        Add
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-sh-green/10 rounded-[24px] text-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-sh-green" />
                <p className="text-[15px] font-bold text-sh-green">All connected!</p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  )
}

