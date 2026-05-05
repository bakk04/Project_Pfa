import { useCallback } from 'react'
import { useAIStore } from '@/store/ai-store'
import type { ClinicalData, DiabetesPrediction } from '@/types/prediction'

export function usePrediction() {
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
        const response = await fetch('/api/prediction/diabetes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clinicalData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Prediction failed')
        }

        const prediction: DiabetesPrediction = await response.json()

        setPrediction(prediction)
        addPredictionToHistory(prediction)

        return prediction
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setPredictionError(message)
        console.error('[v0] Prediction error:', message)
        throw error
      } finally {
        setPredictionLoading(false)
      }
    },
    [setPrediction, addPredictionToHistory, setPredictionLoading, setPredictionError]
  )

  return {
    currentPrediction,
    predictionHistory,
    predictionLoading,
    predictionError,
    predict,
  }
}
