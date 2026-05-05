'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { TABS, TabType } from './ModernSidebar'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const shortLabels: Record<string, string> = {
  overview: 'Summary',
  health: 'Health',
  prediction: 'AI Risk',
  rppg: 'Monitor',
  sources: 'Connect',
  chat: 'AI Chat',
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-6 left-0 right-0 z-[1000] lg:hidden flex justify-center px-6">
      <nav
        className={cn(
          'w-full max-w-lg h-[72px]',
          'bg-[#ffffff]/80 dark:bg-[#1c1c1e]/80 backdrop-blur-3xl',
          'border border-white/20 dark:border-white/5',
          'rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.3)]',
          'flex items-center justify-between px-2 overflow-hidden'
        )}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-1 h-full',
                'transition-all duration-300 active:scale-90',
                'focus:outline-none outline-none border-none bg-transparent'
              )}
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    layoutId="active-bg"
                    className="absolute -inset-2 bg-sh-green/10 rounded-2xl z-0"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon 
                  className={cn(
                    'w-[22px] h-[22px] relative z-10 transition-colors duration-300',
                    isActive ? 'text-sh-green' : 'text-sh-sub'
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-bold tracking-tight relative z-10 transition-colors duration-300',
                  isActive ? 'text-sh-green' : 'text-sh-sub opacity-80'
                )}
              >
                {shortLabels[tab.id] || tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
