'use client'

import type { Vitals } from '@/types/health'
import { getRiskColor, getVitalStatus } from '@/utils/risk-colors'
import { motion } from 'framer-motion'

interface VitalsCardProps {
  vitals: Vitals | null
  isLoading?: boolean
}

export function VitalsCard({ vitals, isLoading }: VitalsCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg ring-1 ring-inset ring-border border-0 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Vitals</h3>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 bg-muted rounded w-20 animate-pulse" />
              <div className="h-5 bg-muted rounded w-16 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!vitals) {
    return (
      <div className="rounded-lg ring-1 ring-inset ring-border border-0 bg-card p-6 text-center">
        <h3 className="text-sm font-semibold text-foreground mb-2">Vitals</h3>
        <p className="text-xs text-muted-foreground mb-3">No vitals data available. Connect a health data source to get started.</p>
        <button className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:opacity-80 transition-opacity">
          Connect Device
        </button>
      </div>
    )
  }

  const vitalReadings = [
    { label: 'Heart Rate', value: vitals.heartRate, unit: 'bpm', key: 'heartRate' },
    { label: 'SpO₂', value: vitals.spO2, unit: '%', key: 'spO2' },
    { label: 'SBP', value: vitals.systolicBP, unit: 'mmHg', key: 'systolicBP' },
    { label: 'DBP', value: vitals.diastolicBP, unit: 'mmHg', key: 'diastolicBP' },
  ]

  const statusToRiskLevel = (status: string): 'low' | 'moderate' | 'high' => {
    if (status === 'normal') return 'low'
    if (status === 'elevated' || status === 'prediabetic' || status === 'low') return 'moderate'
    return 'high'
  }

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="bg-card/80 backdrop-blur-xl rounded-[32px] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-border/40 border-0"
    >
      <h3 className="text-[14px] font-bold tracking-[0.15em] uppercase text-muted-foreground/70 mb-6 px-2">Vital Signs</h3>
      <div className="grid grid-cols-2 gap-4">
        {vitalReadings.map((reading) => {
          const status = reading.value !== undefined ? getVitalStatus(reading.key, reading.value) : 'unknown'
          const riskLevel = statusToRiskLevel(status)
          const colorClass = getRiskColor(riskLevel)
          
          // Micro-trend indicator
          const trendIcon = reading.value !== undefined ? (riskLevel === 'high' ? '↑' : riskLevel === 'moderate' ? '↓' : null) : null

          return (
            <motion.div 
              key={reading.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="p-5 rounded-[24px] bg-muted/20 ring-1 ring-inset ring-border/40 border-0 transition-colors duration-300 hover:bg-muted/40 flex flex-col justify-between"
            >
              <span className="text-[13px] font-semibold text-muted-foreground/80 tracking-wide uppercase mb-3">{reading.label}</span>
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl md:text-5xl font-bold tracking-tighter drop-shadow-sm ${colorClass.text}`}>
                    {reading.value !== undefined ? reading.value : '—'}
                  </span>
                  {trendIcon && (
                    <span className={`text-lg font-bold ${colorClass.text}`}>{trendIcon}</span>
                  )}
                </div>
                <span className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-widest">{reading.unit}</span>
              </div>
            </motion.div>
          )
        })}
      </div>
      {vitals.lastUpdated && (
        <p className="text-[12px] font-medium text-muted-foreground/50 mt-6 px-2 uppercase tracking-widest">
          Updated {new Date(vitals.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </motion.div>
  )
}
