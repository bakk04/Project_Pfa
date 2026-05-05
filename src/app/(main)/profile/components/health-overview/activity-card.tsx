'use client'

import type { Activity } from '@/types/health'
import { motion } from 'framer-motion'

interface ActivityCardProps {
  activity: Activity | null
  isLoading?: boolean
}

export function ActivityCard({ activity, isLoading }: ActivityCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg ring-1 ring-inset ring-border border-0 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Activity</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 bg-muted rounded w-16 animate-pulse" />
              <div className="h-4 bg-muted rounded w-20 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="rounded-lg ring-1 ring-inset ring-border border-0 bg-card p-6 text-center">
        <h3 className="text-sm font-semibold text-foreground mb-2">Activity</h3>
        <p className="text-xs text-muted-foreground mb-3">No activity data available. Sync your health app to track activity.</p>
        <button className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:opacity-80 transition-opacity">
          Sync Activity
        </button>
      </div>
    )
  }

  const activityMetrics = [
    { label: 'Steps', value: activity.steps, unit: '' },
    { label: 'Calories', value: activity.calories, unit: '' },
    { label: 'Exercise', value: activity.exerciseTime, unit: 'min' },
  ]

  // Mock daily goals
  const goals = {
    Steps: 10000,
    Calories: 600,
    Exercise: 30
  }

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="bg-card/80 backdrop-blur-xl rounded-[32px] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] ring-1 ring-inset ring-border/40 border-0 flex flex-col h-full"
    >
      <h3 className="text-[14px] font-bold tracking-[0.15em] uppercase text-muted-foreground/70 mb-6 px-2">Daily Activity</h3>
      <div className="flex-1 flex flex-col justify-center space-y-6 px-2">
        {activityMetrics.map((metric, index) => {
          const colors = [
            { bg: 'bg-emerald-500/10', fill: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
            { bg: 'bg-lime-500/10', fill: 'bg-lime-500', text: 'text-lime-600 dark:text-lime-400' },
            { bg: 'bg-green-500/10', fill: 'bg-green-500', text: 'text-green-600 dark:text-green-400' }
          ]
          const colorSet = colors[index % colors.length]
          const goal = goals[metric.label as keyof typeof goals] || 100
          const progress = Math.min(100, Math.max(0, ((metric.value || 0) / goal) * 100))
          
          return (
            <motion.div 
              key={metric.label}
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="group cursor-default"
            >
              <div className="flex justify-between items-end mb-2">
                <span className="text-[14px] font-bold text-foreground/90 tracking-tight">{metric.label}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tighter text-foreground">
                    {metric.value || '0'}
                  </span>
                  {metric.unit && <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">{metric.unit}</span>}
                </div>
              </div>
              {/* Animated Progress Bar */}
              <div className={`h-3 w-full rounded-full ${colorSet.bg} overflow-hidden relative`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.5, ease: [0.32, 0.72, 0, 1], delay: 0.2 + (index * 0.1) }}
                  className={`absolute top-0 left-0 bottom-0 rounded-full ${colorSet.fill}`}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
      {activity.date && (
        <p className="text-[12px] font-medium text-muted-foreground/50 mt-8 px-2 uppercase tracking-widest">
          Updated {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </motion.div>
  )
}
