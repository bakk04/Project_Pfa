'use client'

import type { Activity } from '@/types/health'
import { motion } from 'framer-motion'
import { GlassCard } from '../shared/GlassCard'
import { Footprints, Flame, Timer, Activity as ActivityIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityCardProps {
  activity: Activity | null
  isLoading?: boolean
}

export function ActivityCard({ activity, isLoading }: ActivityCardProps) {
  if (isLoading) {
    return (
      <GlassCard>
        <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider mb-6">
          Daily Activity
        </h3>
        <div className="space-y-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between items-center mb-2">
                <div className="h-4 w-16 bg-muted/40 rounded" />
                <div className="h-6 w-20 bg-muted/40 rounded" />
              </div>
              <div className="h-3 w-full bg-muted/30 rounded-full" />
            </div>
          ))}
        </div>
      </GlassCard>
    )
  }

  if (!activity) {
    return (
      <GlassCard className="text-center py-10">
        <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
          <ActivityIcon className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Daily Activity</h3>
        <p className="text-xs text-muted-foreground mb-4">
          No activity data available. Sync your health app to track activity.
        </p>
        <button className={cn(
          'px-4 py-2 rounded-xl text-sm font-medium',
          'bg-primary/10 text-primary',
          'hover:bg-primary/20 transition-colors'
        )}>
          Sync Activity
        </button>
      </GlassCard>
    )
  }

  const activityMetrics = [
    { 
      label: 'Steps', 
      value: activity.steps, 
      goal: 10000,
      unit: '', 
      icon: Footprints,
      color: '#4FC3F7'
    },
    { 
      label: 'Calories', 
      value: activity.calories, 
      goal: 600,
      unit: 'kcal', 
      icon: Flame,
      color: '#FF7043'
    },
    { 
      label: 'Exercise', 
      value: activity.exerciseTime, 
      goal: 30,
      unit: 'min', 
      icon: Timer,
      color: '#66BB6A'
    },
  ]

  return (
    <GlassCard>
      <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider mb-6">
        Daily Activity
      </h3>
      <div className="space-y-5">
        {activityMetrics.map((metric, index) => {
          const progress = Math.min(100, Math.max(0, ((metric.value || 0) / metric.goal) * 100))
          const Icon = metric.icon
          
          return (
            <motion.div 
              key={metric.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.01 }}
              className="cursor-default"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${metric.color}15` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: metric.color }} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {metric.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold tracking-tight text-foreground">
                    {(metric.value || 0).toLocaleString()}
                  </span>
                  {metric.unit && (
                    <span className="text-xs font-medium text-muted-foreground/60 uppercase">
                      {metric.unit}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Progress bar */}
              <div 
                className="h-2.5 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: `${metric.color}15` }}
              >
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.2, delay: 0.3 + (index * 0.1), ease: [0.32, 0.72, 0, 1] }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: metric.color }}
                />
              </div>
              
              {/* Goal text */}
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground/50">
                  {Math.round(progress)}% of goal
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {metric.goal.toLocaleString()} {metric.unit}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
      {activity.date && (
        <p className="text-[11px] text-muted-foreground/50 mt-6 uppercase tracking-wider">
          Updated {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </GlassCard>
  )
}
