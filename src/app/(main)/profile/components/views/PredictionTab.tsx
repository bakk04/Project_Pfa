'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ClinicalForm } from '../ai-prediction/clinical-form'
import { PredictionCard } from '../ai-prediction/prediction-card'
import { usePrediction } from '@/hooks/usePrediction'
import { GlassCard } from '../shared/GlassCard'
import { BrainCircuit, FileText } from 'lucide-react'

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

export function PredictionTab() {
  const { currentPrediction, predictionLoading, predict } = usePrediction()

  const handlePredictionSubmit = async (clinicalData: any) => {
    await predict(clinicalData)
  }

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
          <BrainCircuit className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">AI Health Prediction</h2>
          <p className="text-sm text-muted-foreground">Advanced cardiovascular risk assessment</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Risk Assessment Result */}
        <motion.div variants={itemVariants} className="xl:col-span-2">
          <GlassCard className="h-full">
            <div className="flex items-center gap-2 mb-6">
              <BrainCircuit className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider">
                Risk Assessment
              </h3>
            </div>
            <PredictionCard prediction={currentPrediction} isLoading={predictionLoading} />
          </GlassCard>
        </motion.div>

        {/* Clinical Data Form */}
        <motion.div variants={itemVariants} className="xl:col-span-3">
          <GlassCard>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wider">
                Clinical Data
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Provide accurate data for precise AI analysis
            </p>
            <ClinicalForm onSubmit={handlePredictionSubmit} isLoading={predictionLoading} />
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  )
}
