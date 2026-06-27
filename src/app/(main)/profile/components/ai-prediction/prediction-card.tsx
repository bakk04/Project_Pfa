'use client'

import React, { useState } from 'react'
import { RiskGauge } from './risk-gauge'
import type { DiabetesPrediction, ClinicalData } from '@/types/prediction'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, FileDown, Info, X } from 'lucide-react'
import { usePrediction } from '@/hooks/usePrediction'
import { generateMedicalReport } from '@/utils/report'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PredictionCardProps {
  prediction: DiabetesPrediction | null
  clinicalData?: ClinicalData | null
  isLoading?: boolean
}

export function PredictionCard({ prediction, clinicalData, isLoading }: PredictionCardProps) {
  const { askAI } = usePrediction()
  const { data: session } = useSession()
  const [aiExplanation, setAiExplanation] = useState<string | null>(null)
  const [isAskingAI, setIsAskingAI] = useState(false)

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

  const getOrFetchClinicalData = async () => {
    if (clinicalData) {
      return clinicalData
    }
    
    try {
      const res = await fetch('/api/user/profile')
      if (res.ok) {
        const userData = await res.json()
        
        const ensureBool = (val: any) => {
          if (typeof val === 'boolean') return val;
          if (typeof val === 'string') {
            const s = val.toLowerCase();
            return ['true', 'yes', 'current', 'parent', 'sibling', 'both', 'family'].includes(s);
          }
          return !!val;
        };

        return {
          weight: userData?.healthData?.weight || 75,
          height: userData?.healthData?.height || 175,
          glucose_fasting_mg_dl: 100,
          hba1c: 5.4,
          smoking: ensureBool(userData?.healthData?.smoking),
          familyHistory: ensureBool(userData?.healthData?.familyHistory),
          gender: userData?.healthData?.gender ?? 1,
          bloodpressure: 120,
          pregnancies: 0,
          skinthickness: 20,
          insulin: 80,
          diabetespedigreefunction: 0.47,
          dateOfBirth: userData?.dateOfBirth ? userData.dateOfBirth.split('T')[0] : "1990-01-01"
        }
      }
    } catch (fetchErr) {
      console.error('[PredictionCard] Fetch profile error:', fetchErr)
    }

    return {
      weight: 75,
      height: 175,
      glucose_fasting_mg_dl: 100,
      hba1c: 5.4,
      smoking: false,
      familyHistory: false,
      gender: 1,
      bloodpressure: 120,
      pregnancies: 0,
      skinthickness: 20,
      insulin: 80,
      diabetespedigreefunction: 0.47,
      dateOfBirth: "1990-01-01"
    }
  }

  const handleAskAI = async () => {
    setIsAskingAI(true)
    try {
      const activeClinicalData = await getOrFetchClinicalData()
      const explanation = await askAI(prediction, activeClinicalData)
      setAiExplanation(explanation)
    } catch (error: any) {
      console.error('[PredictionCard] Ask AI error:', error)
      toast.error(error?.message || 'Failed to get AI explanation. Please try again.')
    } finally {
      setIsAskingAI(false)
    }
  }

  const handleDownloadReport = async () => {
    try {
      const patientInfo = {
        name: session?.user?.name || 'Valued Patient',
        id: session?.user?.id || 'ANON-123'
      }
      const activeClinicalData = await getOrFetchClinicalData()
      generateMedicalReport(prediction, activeClinicalData, patientInfo)
    } catch (error) {
      console.error('[PredictionCard] Download report error:', error)
      toast.error('Failed to generate medical report.')
    }
  }

  const getRiskColor = (status: string) => {
    switch (status) {
      case 'HIGH': return 'text-red-500'
      case 'MODERATE': return 'text-orange-500'
      case 'LOW': return 'text-green-500'
      default: return 'text-foreground'
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center w-full"
    >
      {/* Gauge - Primary Focus */}
      <div className="mb-8 w-full flex flex-col items-center">
        <RiskGauge probability={prediction.final_probability} hasDiabetesRisk={prediction.risk_status !== 'LOW'} />
        <div className={`mt-4 text-2xl font-bold ${getRiskColor(prediction.risk_status)}`}>
          {prediction.risk_status} RISK
        </div>
      </div>

      {/* Clinical Flags */}
      {prediction.flags && prediction.flags.length > 0 && (
        <div className="w-full bg-muted/20 ring-1 ring-inset ring-border/40 border-0 rounded-[24px] p-5 mb-6">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-muted-foreground/70 mb-4 px-1">Clinical Flags</p>
          <div className="flex flex-wrap gap-2">
            {prediction.flags.map((flag, index) => (
              <span key={index} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence & Uncertainty */}
      <div className="w-full grid grid-cols-2 gap-4 mb-8">
        <div className="flex flex-col p-4 rounded-[20px] bg-muted/10 ring-1 ring-inset ring-border/30">
          <span className="text-[12px] font-medium text-muted-foreground mb-1">Probability</span>
          <span className="text-[18px] font-bold text-foreground">{(prediction.final_probability * 100).toFixed(1)}%</span>
        </div>
        <div className="flex flex-col p-4 rounded-[20px] bg-muted/10 ring-1 ring-inset ring-border/30">
          <span className="text-[12px] font-medium text-muted-foreground mb-1">Uncertainty</span>
          <span className="text-[18px] font-bold text-foreground">{(prediction.uncertainty * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex gap-3 mb-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={isAskingAI ? { opacity: [0.7, 1, 0.7], transition: { repeat: Infinity, duration: 1.5 } } : {}}
          onClick={handleAskAI}
          disabled={isAskingAI}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all disabled:opacity-50 text-sm shadow-lg",
            "bg-sh-green text-white shadow-sh-green/20"
          )}
        >
          <Brain className={cn("w-4 h-4", isAskingAI && "animate-pulse")} />
          {isAskingAI ? 'Consulting AI...' : 'Ask AI'}
        </motion.button>
        <button
          onClick={handleDownloadReport}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-secondary text-secondary-foreground rounded-xl font-bold hover:opacity-90 transition-all shadow-sm"
        >
          <FileDown className="w-4 h-4" />
          Report
        </button>
      </div>

      {prediction.timestamp && (
        <div className="text-center w-full">
          <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">
            Analysis Reference: {new Date(prediction.timestamp).toLocaleString()}
          </p>
        </div>
      )}

      {/* AI Explanation Modal */}
      <AnimatePresence>
        {aiExplanation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">AI Clinical Insights</h3>
                    <p className="text-xs text-muted-foreground">Powered by Gemini AI</p>
                  </div>
                </div>
                <button onClick={() => setAiExplanation(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto text-foreground/90 leading-relaxed whitespace-pre-wrap text-sm">
                {aiExplanation}
              </div>

              <div className="p-6 bg-muted/30 border-t border-border flex justify-end">
                <button 
                  onClick={() => setAiExplanation(null)}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
