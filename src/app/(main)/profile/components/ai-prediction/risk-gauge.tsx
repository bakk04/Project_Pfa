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

  // Determine color based on risk - Unified Lime Green Theme
  let color = '#34C759' // Primary Lime Green
  let riskLabel = 'Optimal'

  if (probability > 0.75) {
    color = '#1e7e34' // Darker Green for higher risk/attention
    riskLabel = 'Attention'
  } else if (probability > 0.5) {
    color = '#28a745' // Medium Green
    riskLabel = 'Observation'
  }

  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (probability * circumference)

  return (
    <div className={styles.container}>
      <div className={styles.gaugeWrapper} style={{ width: 180, height: 180 }}>
        <svg className={styles.svg} viewBox="0 0 180 180">
          <circle
            cx="90"
            cy="90"
            r={radius}
            className={styles.track}
            strokeWidth="14"
          />
          <motion.circle
            cx="90"
            cy="90"
            r={radius}
            className={styles.progress}
            stroke={color}
            strokeWidth="14"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        <div className={styles.centerContent}>
          <span className={styles.percentage} style={{ color, fontSize: 42 }}>{percentage}%</span>
          <span className={styles.riskText} style={{ fontSize: 13 }}>Index</span>
        </div>
      </div>

      <div className={styles.labelWrapper}>
        <h4 className={styles.labelTitle} style={{ color, fontSize: 24 }}>{riskLabel} Profile</h4>
        <p className={styles.labelDesc} style={{ fontSize: 16 }}>
          {hasDiabetesRisk
            ? 'Our clinical model has identified elevated risk patterns in your biometric data flow.'
            : 'Your current biometric intelligence markers are within standard physiological ranges.'}
        </p>
      </div>
    </div>
  )
}
