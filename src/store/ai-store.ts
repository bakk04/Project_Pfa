import { create } from 'zustand'
import type { DiabetesPrediction, ChatMessage } from '@/types/prediction'

export type { ChatMessage }

interface AIStoreState {
  // Prediction
  currentPrediction: DiabetesPrediction | null
  predictionHistory: DiabetesPrediction[]
  predictionLoading: boolean
  predictionError: string | null

  // Chat
  messages: ChatMessage[]
  chatLoading: boolean
  chatError: string | null

  // Actions
  setPrediction: (prediction: DiabetesPrediction) => void
  addPredictionToHistory: (prediction: DiabetesPrediction) => void
  getPredictionHistory: () => DiabetesPrediction[]
  setPredictionLoading: (loading: boolean) => void
  setPredictionError: (error: string | null) => void
  clearPredictionHistory: () => void

  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  setChatLoading: (loading: boolean) => void
  setChatError: (error: string | null) => void

  reset: () => void
}

const initialState = {
  currentPrediction: null,
  predictionHistory: [] as DiabetesPrediction[],
  predictionLoading: false,
  predictionError: null,
  messages: [] as ChatMessage[],
  chatLoading: false,
  chatError: null,
}

export const useAIStore = create<AIStoreState>((set, get) => ({
  ...initialState,

  // Prediction actions
  setPrediction: (prediction) =>
    set({
      currentPrediction: prediction,
      predictionError: null,
    }),

  addPredictionToHistory: (prediction) =>
    set((state) => {
      const updated = [prediction, ...state.predictionHistory].slice(0, 100) // Keep last 100
      return {
        currentPrediction: prediction,
        predictionHistory: updated,
      }
    }),

  getPredictionHistory: () => get().predictionHistory,

  setPredictionLoading: (loading) => set({ predictionLoading: loading }),

  setPredictionError: (error) => set({ predictionError: error }),

  clearPredictionHistory: () =>
    set({
      predictionHistory: [],
      currentPrediction: null,
    }),

  // Chat actions
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      chatError: null,
    })),

  clearMessages: () => set({ messages: [] }),

  setChatLoading: (loading) => set({ chatLoading: loading }),

  setChatError: (error) => set({ chatError: error }),

  reset: () => set(initialState),
}))
