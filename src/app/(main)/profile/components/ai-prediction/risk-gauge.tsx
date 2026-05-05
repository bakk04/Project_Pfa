'use client'

import React from 'react'
import { motion } from 'framer-motion'
import styles from './RiskGauge.module.css'

interface RiskGaugeProps {
  probability: number // 0-1
  hasDiabetesRisk: boolean
}

export function RiskGauge({ probability, hasDiabetesRisk }: RiskGaugeProps) {
  const percentage = Math.round(probability * 100)

  // Determine color and label based on standard risk levels
  let color = '#34C759' // Green (Low)
  let riskLabel = 'Low'

  if (probability > 0.7) {
    color = '#FF3B30' // Red (High)
    riskLabel = 'High'
  } else if (probability > 0.3) {
    color = '#FF9500' // Orange (Moderate)
    riskLabel = 'Moderate'
  }

  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (probability * circumference)

  return (
    <div className={styles.container}>
      <div className={styles.gaugeWrapper} style={{ width: 220, height: 220 }}>
        <svg className={styles.svg} viewBox="0 0 180 180">
          {/* Background circle */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            className={styles.track}
            strokeWidth="10"
            stroke="var(--sh-border)"
            fill="transparent"
          />
          {/* Progress circle */}
          <motion.circle
            cx="90"
            cy="90"
            r={radius}
            className={styles.progress}
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            fill="transparent"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>

        <div className={styles.centerContent}>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-black tracking-tighter" style={{ color }}>{percentage}%</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Risk Score</span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <h4 className="text-xl font-bold uppercase tracking-wider mb-2" style={{ color }}>{riskLabel} Risk</h4>
        <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mx-auto px-4">
          {probability > 0.7 
            ? 'High probability of risk detected. Clinical follow-up is strongly recommended.'
            : probability > 0.3
            ? 'Moderate risk patterns identified. Consider lifestyle adjustments and monitoring.'
            : 'Low risk profile. Continue maintaining healthy habits and periodic checkups.'}
        </p>
      </div>
    </div>
  )
}
