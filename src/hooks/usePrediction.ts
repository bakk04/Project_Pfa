import { useCallback } from 'react'
import { useAIStore } from '@/store/ai-store'
import type { ClinicalData, DiabetesPrediction, PredictionRequest, RppgFeatures } from '@/types/prediction'
import { useSession } from 'next-auth/react'
import { GoogleGenerativeAI } from '@google/generative-ai'

export function usePrediction() {
  const { data: session } = useSession()
  const currentPrediction = useAIStore((state) => state.currentPrediction)
  const predictionHistory = useAIStore((state) => state.predictionHistory)
  const predictionLoading = useAIStore((state) => state.predictionLoading)
  const predictionError = useAIStore((state) => state.predictionError)

  const setPrediction = useAIStore((state) => state.setPrediction)
  const addPredictionToHistory = useAIStore((state) => state.addPredictionToHistory)
  const setPredictionLoading = useAIStore((state) => state.setPredictionLoading)
  const setPredictionError = useAIStore((state) => state.setPredictionError)

  const predict = useCallback(
    async (clinicalData: ClinicalData) => {
      setPredictionLoading(true)
      setPredictionError(null)

      try {
        // 1. Get rPPG features from localStorage (populated by FacePhysMonitor)
        const rppgStored = localStorage.getItem('latest_rppg_result')
        let rppg_features: RppgFeatures = {
          heart_rate: 70,
          hrv_sdnn: 50,
          hrv_rmssd: 40,
          spo2: 98
        }

        if (rppgStored) {
          const data = JSON.parse(rppgStored)
          rppg_features = {
            heart_rate: Math.round(data.heartRate || 70),
            hrv_sdnn: Math.round(data.hrv_sdnn || 50),
            hrv_rmssd: Math.round(data.hrv_rmssd || 40),
            spo2: Math.round(data.spo2 || 98)
          }
        }

        // Ensure clinical data has correct types (rounding ints, explicit floats, and robust booleans)
        const ensureBool = (val: any) => {
          if (typeof val === 'boolean') return val;
          if (typeof val === 'string') {
            const s = val.toLowerCase();
            return ['true', 'yes', 'current', 'parent', 'sibling', 'both', 'family'].includes(s);
          }
          return !!val;
        };

        const request: PredictionRequest = {
          patient_id: session?.user?.id || session?.user?.email || 'ANON_USER_001',
          clinical_data: {
            ...clinicalData,
            weight: Math.round(clinicalData.weight),
            height: Math.round(clinicalData.height),
            glucose_fasting_mg_dl: Math.round(clinicalData.glucose_fasting_mg_dl),
            hba1c: parseFloat(String(clinicalData.hba1c)),
            bloodpressure: Math.round(clinicalData.bloodpressure),
            pregnancies: Math.round(clinicalData.pregnancies),
            skinthickness: Math.round(clinicalData.skinthickness),
            insulin: Math.round(clinicalData.insulin),
            diabetespedigreefunction: parseFloat(String(clinicalData.diabetespedigreefunction)),
            smoking: ensureBool(clinicalData.smoking),
            familyHistory: ensureBool(clinicalData.familyHistory),
            dateOfBirth: String(clinicalData.dateOfBirth).split('T')[0]
          },
          rppg_features,
          temporal_data: []
        }

        // 2. Call the clinical AI backend via our proxy
        const response = await fetch('/api/monitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('[Clinical AI] Backend Error:', {
            status: response.status,
            detail: errorData
          })
          const detailMsg = errorData.details?.detail?.[0]?.msg || errorData.message || `Clinical prediction failed (Status ${response.status})`
          throw new Error(detailMsg)
        }

        const data = await response.json()
        
        // Map the backend response to our internal DiabetesPrediction interface
        const prediction: DiabetesPrediction = {
          risk_status: data.risk_status,
          final_probability: data.final_probability,
          probability_ensemble: data.probability_ensemble,
          probability_calibrated: data.probability_calibrated,
          uncertainty: data.uncertainty,
          flags: data.flags || [],
          timestamp: new Date().toISOString()
        }

        setPrediction(prediction)
        addPredictionToHistory(prediction)

        return prediction
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setPredictionError(message)
        console.error('[Clinical AI] Prediction error:', message)
        throw error
      } finally {
        setPredictionLoading(false)
      }
    },
    [session, setPrediction, addPredictionToHistory, setPredictionLoading, setPredictionError]
  )

  const askAI = useCallback(async (prediction: DiabetesPrediction, clinicalData: ClinicalData) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction, clinicalData }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get AI explanation')
      }

      const data = await response.json()
      return data.text
    } catch (error) {
      console.error('[Gemini AI] Error:', error)
      throw new Error('Failed to get AI explanation')
    }
  }, [])

  return {
    currentPrediction,
    predictionHistory,
    predictionLoading,
    predictionError,
    predict,
    askAI,
  }
}
