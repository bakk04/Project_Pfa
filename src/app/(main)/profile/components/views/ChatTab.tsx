'use client'

import React from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { GlassCard } from '../shared/GlassCard'
import { MessageSquare, Bot } from 'lucide-react'

// Lazy load chat widget
const ChatWidgetLazy = dynamic(
  () => import('../ai-chat/chat-widget').then((mod) => ({ default: mod.ChatWidget })),
  {
    loading: () => (
      <div className="flex flex-col items-center justify-center h-[500px]">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Bot className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <p className="text-muted-foreground">Loading AI Assistant...</p>
      </div>
    ),
  }
)

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

export function ChatTab() {
  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-sh-card flex items-center justify-center shadow-sh">
          <MessageSquare className="w-6 h-6 text-sh-green" />
        </div>
        <div>
          <h2 className="text-[22px] font-bold text-sh-text">Health AI Assistant</h2>
          <p className="text-sm font-bold text-sh-sub">Direct interface with Medical Intelligence Core</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <GlassCard padding="none" className="overflow-hidden">
          <div className="p-6 border-b border-sh-border bg-sh-card/50">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sh-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sh-green"></span>
              </div>
              <span className="text-[13px] font-bold text-sh-sub uppercase tracking-widest">Neural Assistant Online</span>
            </div>
          </div>
          <div className="h-[600px] bg-sh-bg">
            <ChatWidgetLazy />
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}

