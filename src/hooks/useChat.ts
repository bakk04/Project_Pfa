import { useCallback } from 'react'
import { useAIStore, type ChatMessage } from '@/store/ai-store'

export function useChat() {
  const messages = useAIStore((state) => state.messages)
  const chatLoading = useAIStore((state) => state.chatLoading)
  const chatError = useAIStore((state) => state.chatError)

  const addMessage = useAIStore((state) => state.addMessage)
  const clearMessages = useAIStore((state) => state.clearMessages)
  const setChatLoading = useAIStore((state) => state.setChatLoading)
  const setChatError = useAIStore((state) => state.setChatError)

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return

      // Add user message to chat
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      }
      addMessage(userMsg)

      setChatLoading(true)
      setChatError(null)

      try {
        const response = await fetch('/api/chat/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            conversationHistory: messages,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Chat request failed')
        }

        const data = await response.json()

        // Add assistant message to chat
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        }
        addMessage(assistantMsg)

        return data
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setChatError(message)
        console.error('[v0] Chat error:', message)
        throw error
      } finally {
        setChatLoading(false)
      }
    },
    [messages, addMessage, setChatLoading, setChatError]
  )

  return {
    messages,
    chatLoading,
    chatError,
    sendMessage,
    clearMessages,
  }
}
