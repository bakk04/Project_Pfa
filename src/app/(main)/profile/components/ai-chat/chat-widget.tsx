'use client'

import { useEffect, useRef } from 'react'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { useChat } from '@/hooks/useChat'
import { cn } from '@/lib/utils'

export function ChatWidget() {
  const { messages, chatLoading, chatError, sendMessage, clearMessages } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (message: string) => {
    try {
      await sendMessage(message)
    } catch (error) {
      console.error('[v0] Failed to send message:', error)
    }
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-sh-bg/30">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-[12px] font-black tracking-[0.2em] uppercase text-sh-sub opacity-80">AI Interaction</h3>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-[13px] font-bold text-sh-green hover:bg-sh-green/10 transition-all px-4 py-1.5 rounded-full"
          >
            Reset
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-6 space-y-4 pr-2 custom-scrollbar">
        {messages.length === 0 && !chatLoading && (
          <div className="text-center py-10 flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 rounded-[32px] bg-sh-card shadow-sh flex items-center justify-center mb-6">
               <div className="w-10 h-10 rounded-full bg-sh-green/20 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-sh-green animate-pulse" />
               </div>
            </div>
            <p className="text-[16px] font-bold text-sh-text leading-tight max-w-[240px]">
              How can I help you with your health goals today?
            </p>
            <p className="text-[13px] font-medium text-sh-sub mt-2 max-w-[200px]">
              Ask me about your vitals, diet, or exercise.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-sh-card shadow-sh rounded-[24px] rounded-bl-[6px] px-5 py-3.5 border border-sh-border">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sh-green animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-sh-green animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-sh-green animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {chatError && (
          <div className="text-[14px] font-bold text-sh-red bg-sh-red/10 p-4 rounded-[24px] text-center border border-sh-red/20 shadow-sm mx-4">
            {chatError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-4">
        <ChatInput onSendMessage={handleSendMessage} disabled={chatLoading} />
      </div>
    </div>
  )
}
