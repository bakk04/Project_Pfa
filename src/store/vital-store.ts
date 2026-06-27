import { create } from 'zustand'

export interface TestSession {
  id: string
  timestamp: string
  status: 'success' | 'failed' | 'insufficient_signal' | 'model_unavailable'
  metrics: {
    hr?: number
    sqi?: number
    risk_status?: string
    probability?: number
  }
}

interface VitalStoreState {
  onboardingData: any | null
  predictionResult: any | null
  isLoading: boolean
  error: string | null
  testHistory: TestSession[]
  
  setOnboardingData: (data: any) => void
  setPredictionResult: (result: any, sessionData?: TestSession) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  fetchTestHistory: () => Promise<void>
}

export const useVitalStore = create<VitalStoreState>((set) => ({
  onboardingData: null,
  predictionResult: null,
  isLoading: false,
  error: null,
  testHistory: [],

  setOnboardingData: (data) => set({ onboardingData: data }),
  setPredictionResult: (result, sessionData) => set((state) => ({ 
    predictionResult: result,
    testHistory: sessionData ? [sessionData, ...state.testHistory] : state.testHistory
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error: error }),
  reset: () => set({ onboardingData: null, predictionResult: null, isLoading: false, error: null }),
  fetchTestHistory: async () => {
    try {
      const res = await fetch('/api/user/measurements')
      if (res.ok) {
        const history = await res.json()
        set({ testHistory: history })
      }
    } catch (err) {
      console.error('[useVitalStore] Failed to fetch test history:', err)
    }
  }
}))
