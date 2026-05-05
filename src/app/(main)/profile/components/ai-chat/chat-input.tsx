'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SendHorizonal } from 'lucide-react'

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void>
  disabled?: boolean
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isSending || disabled) {
      return
    }

    setIsSending(true)
    try {
      await onSendMessage(input.trim())
      setInput('')
    } catch (error) {
      console.error('[v0] Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-center">
      <div className="relative flex-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your health..."
          disabled={disabled || isSending}
          className={cn(
            "w-full px-6 py-4 text-[15px] font-medium rounded-[28px] border-none shadow-sh transition-all duration-300",
            "bg-sh-card text-sh-text placeholder:text-sh-sub/60",
            "focus:outline-none focus:ring-2 focus:ring-sh-green/20 focus:shadow-sh-hover",
            "disabled:opacity-50"
          )}
        />
      </div>
      <button
        type="submit"
        disabled={disabled || isSending || !input.trim()}
        className={cn(
          "w-[54px] h-[54px] flex items-center justify-center rounded-full transition-all duration-300 active:scale-90",
          "bg-sh-green text-white shadow-lg shadow-sh-green/20",
          "hover:bg-sh-green/90 hover:shadow-sh-green/30",
          "disabled:opacity-50 disabled:bg-sh-sub/20 disabled:shadow-none disabled:cursor-not-allowed"
        )}
      >
        <SendHorizonal className="w-6 h-6" />
      </button>
    </form>
  )
}
