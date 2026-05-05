'use client'

import type { Vitals } from '@/types/health'
import { getRiskColor, getVitalStatus } from '@/utils/risk-colors'
import { motion } from 'framer-motion'
import { GlassCard } from '../shared/GlassCard'
import { Heart, Activity, Gauge, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VitalsCardProps {
  vitals: Vitals | null
  isLoading?: boolean
}

export function VitalsCard({ vitals, isLoading }: VitalsCardProps) {
  if (isLoading) {
    return (
      <GlassCard>
        <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider mb-6">
          Vital Signs
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-muted/20 animate-pulse">
              <div className="h-4 w-16 bg-muted/40 rounded mb-3" />
              <div className="h-10 w-20 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </GlassCard>
    )
  }

  if (!vitals) {
    return (
      <GlassCard className="text-center py-10">
        <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Vital Signs</h3>
        <p className="text-xs text-muted-foreground mb-4">
          No vitals data available. Connect a health data source to get started.
        </p>
        <button className={cn(
          'px-4 py-2 rounded-xl text-sm font-medium',
          'bg-primary/10 text-primary',
          'hover:bg-primary/20 transition-colors'
        )}>
          Connect Device
        </button>
      </GlassCard>
    )
  }

  const vitalReadings = [
    { label: 'Heart Rate', value: vitals.heartRate, unit: 'bpm', key: 'heartRate', icon: Heart, color: '#EF5350' },
    { label: 'SpO₂', value: vitals.spO2, unit: '%', key: 'spO2', icon: Activity, color: '#42A5F5' },
    { label: 'SBP', value: vitals.systolicBP, unit: 'mmHg', key: 'systolicBP', icon: Gauge, color: '#AB47BC' },
    { label: 'DBP', value: vitals.diastolicBP, unit: 'mmHg', key: 'diastolicBP', icon: Gauge, color: '#7E57C2' },
  ]

  const statusToRiskLevel = (status: string): 'low' | 'moderate' | 'high' => {
    if (status === 'normal') return 'low'
    if (status === 'elevated' || status === 'prediabetic' || status === 'low') return 'moderate'
    return 'high'
  }

  return (
    <GlassCard>
      <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider mb-6">
        Vital Signs
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {vitalReadings.map((reading, index) => {
          const status = reading.value !== undefined ? getVitalStatus(reading.key, reading.value) : 'unknown'
          const riskLevel = statusToRiskLevel(status)
          const colorClass = getRiskColor(riskLevel)
          const Icon = reading.icon
          const trendIcon = reading.value !== undefined ? (
            riskLevel === 'high' ? TrendingUp : 
            riskLevel === 'moderate' ? TrendingDown : null
          ) : null

          return (
            <motion.div 
              key={reading.key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'p-5 rounded-2xl',
                'bg-muted/20 dark:bg-muted/10',
                'border border-border/30',
                'transition-all duration-200',
                'hover:bg-muted/30 dark:hover:bg-muted/20',
                'cursor-default'
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${reading.color}15` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: reading.color }} />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {reading.label}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  'text-3xl font-bold tracking-tight',
                  colorClass.text
                )}>
                  {reading.value !== undefined ? reading.value : '—'}
                </span>
                {trendIcon && (
                  <span className={cn('text-sm', colorClass.text)}>
                    {trendIcon === TrendingUp ? '↑' : '↓'}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                {reading.unit}
              </span>
            </motion.div>
          )
        })}
      </div>
      {vitals.lastUpdated && (
        <p className="text-[11px] text-muted-foreground/50 mt-6 uppercase tracking-wider">
          Updated {new Date(vitals.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </GlassCard>
  )
}
