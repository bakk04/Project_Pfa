'use client'

import { RiskGauge } from './risk-gauge'
import type { DiabetesPrediction } from '@/types/prediction'
import { motion } from 'framer-motion'

interface PredictionCardProps {
  prediction: DiabetesPrediction | null
  isLoading?: boolean
}

export function PredictionCard({ prediction, isLoading }: PredictionCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg ring-1 ring-inset ring-border border-0 bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Risk Assessment</h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!prediction) {
    return (
      <div className="rounded-lg ring-1 ring-inset ring-border border-0 bg-card p-6 text-center">
        <h3 className="text-sm font-semibold text-foreground mb-2">Risk Assessment</h3>
        <p className="text-xs text-muted-foreground mb-3">Fill in your clinical data and submit the form to get your diabetes risk assessment.</p>
      </div>
    )
  }

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-col items-center"
    >
      {/* Gauge - Primary Focus */}
      <div className="mb-10 w-full flex justify-center scale-110">
        <RiskGauge probability={prediction.probability} hasDiabetesRisk={prediction.hasDiabetesRisk} />
      </div>

      {/* Clinical Flags - Minimal Key-Value Pairs */}
      {(prediction.clinicalFlags.highGlucose ||
        prediction.clinicalFlags.highBMI ||
        prediction.clinicalFlags.hypertension ||
        prediction.clinicalFlags.sedentary) && (
        <div className="w-full bg-muted/20 ring-1 ring-inset ring-border/40 border-0 rounded-[24px] p-5 mb-8">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-muted-foreground/70 mb-4 px-1">Clinical Flags</p>
          <div className="space-y-1">
            {prediction.clinicalFlags.highGlucose && (
              <div className="flex justify-between items-center py-3 px-2 rounded-[16px] hover:bg-muted/40 transition-colors">
                <span className="text-[15px] font-medium text-foreground/90">Fasting Glucose</span>
                <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">Concern</span>
              </div>
            )}
            {prediction.clinicalFlags.highBMI && (
              <div className="flex justify-between items-center py-3 px-2 rounded-[16px] hover:bg-muted/40 transition-colors">
                <span className="text-[15px] font-medium text-foreground/90">BMI</span>
                <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">Elevated</span>
              </div>
            )}
            {prediction.clinicalFlags.hypertension && (
              <div className="flex justify-between items-center py-3 px-2 rounded-[16px] hover:bg-muted/40 transition-colors">
                <span className="text-[15px] font-medium text-foreground/90">Blood Pressure</span>
                <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">High</span>
              </div>
            )}
            {prediction.clinicalFlags.sedentary && (
              <div className="flex justify-between items-center py-3 px-2 rounded-[16px] hover:bg-muted/40 transition-colors">
                <span className="text-[15px] font-medium text-foreground/90">Lifestyle</span>
                <span className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">Sedentary</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confidence - Tertiary Info */}
      <div className="w-full flex justify-between items-center px-4 py-4 rounded-[20px] bg-muted/10 ring-1 ring-inset ring-border/30 border-0">
        <span className="text-[14px] font-medium text-muted-foreground">Model Confidence</span>
        <span className="text-[16px] font-bold tracking-tight text-foreground/90">{Math.round((1 - prediction.uncertainty) * 100)}%</span>
      </div>

      {prediction.timestamp && (
        <div className="mt-8 text-center w-full">
          <p className="text-[12px] font-bold text-muted-foreground/50 uppercase tracking-widest">
            Assessed {new Date(prediction.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      )}
    </motion.div>
  )
}
