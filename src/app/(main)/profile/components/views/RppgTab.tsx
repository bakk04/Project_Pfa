'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { RppgLauncher } from '../rppg/rppg-launcher'
import { RppgStatus } from '../rppg/rppg-status'
import { GlassCard } from '../shared/GlassCard'
import { Camera, Activity, Info, Sun, Hand, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const signalGuides = [
  {
    icon: Sun,
    title: 'Lighting',
    description: 'Ensure bright, diffuse light on your face. Avoid shadows or direct sunlight.',
    color: '#FFCA28'
  },
  {
    icon: Hand,
    title: 'Stability',
    description: 'Hold device steady. Excessive motion reduces signal quality significantly.',
    color: '#42A5F5'
  },
  {
    icon: Clock,
    title: 'Duration',
    description: '30 seconds minimum for accurate cardiovascular data extraction.',
    color: '#66BB6A'
  }
]

const qualityLevels = [
  { label: 'Excellent', range: 'Above 75%', color: 'bg-emerald-500', textColor: 'text-emerald-500' },
  { label: 'Good', range: '50 – 75%', color: 'bg-blue-500', textColor: 'text-blue-500' },
  { label: 'Fair', range: 'Below 50%', color: 'bg-amber-500', textColor: 'text-amber-500' },
]

export function RppgTab() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
          <Camera className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Vitals Monitor</h2>
          <p className="text-sm text-muted-foreground">Non-invasive cardiovascular sensing via rPPG</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Vitals Scan Launcher */}
        <motion.div variants={itemVariants} className="lg:col-span-5">
          <GlassCard className="h-full">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider">
                Vitals Scan
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              High-precision optical hemodynamic analysis
            </p>
            <RppgLauncher />
          </GlassCard>
        </motion.div>

        {/* Scan Status */}
        <motion.div variants={itemVariants} className="lg:col-span-4">
          <GlassCard className="h-full">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider">
                Scan Status
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Latest measurement result
            </p>
            <RppgStatus />
          </GlassCard>
        </motion.div>

        {/* Signal Quality Guide */}
        <motion.div variants={itemVariants} className="lg:col-span-3">
          <GlassCard className="h-full">
            <div className="flex items-center gap-2 mb-6">
              <Info className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider">
                Signal Guide
              </h3>
            </div>
            
            <div className="space-y-5">
              {signalGuides.map((guide) => {
                const Icon = guide.icon
                return (
                  <div key={guide.title} className="flex items-start gap-3">
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${guide.color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: guide.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-0.5">
                        {guide.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {guide.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quality Legend */}
            <div className="mt-6 pt-5 border-t border-border/30">
              <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">
                Signal Quality
              </p>
              <div className="space-y-2.5">
                {qualityLevels.map((level) => (
                  <div key={level.label} className="flex items-center gap-3">
                    <div className={cn('w-2.5 h-2.5 rounded-full', level.color)} />
                    <span className={cn('text-xs font-medium', level.textColor)}>
                      {level.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {level.range}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  )
}
