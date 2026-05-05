'use client'

import type { ChatMessage as ChatMessageType } from '@/store/ai-store'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn("flex mb-2", isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          "max-w-[80%] px-5 py-3.5 shadow-sh border",
          isUser
            ? 'bg-sh-green text-white rounded-[26px] rounded-br-[4px] border-sh-green/20'
            : 'bg-sh-card text-sh-text rounded-[26px] rounded-bl-[4px] border-sh-border'
        )}
      >
        <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <div className="flex items-center gap-2 mt-2">
           <p className={cn(
             "text-[10px] font-black uppercase tracking-widest",
             isUser ? 'text-white/60' : 'text-sh-sub/60'
           )}>
             {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
           </p>
           {!isUser && (
             <div className="w-1 h-1 rounded-full bg-sh-green" />
           )}
        </div>
      </div>
    </motion.div>
  )
}
