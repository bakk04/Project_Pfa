'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { 
  LayoutGrid, 
  HeartPulse, 
  BrainCircuit, 
  Camera, 
  Link2, 
  MessageSquare,
  LogOut,
  Moon,
  Sun,
  Activity
} from 'lucide-react'

export type TabType = 'overview' | 'health' | 'prediction' | 'rppg' | 'sources' | 'chat'

interface SidebarProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  isOpen?: boolean
  isCollapsed?: boolean
  onClose?: () => void
}

export const TABS = [
  { id: 'overview', label: 'Summary', icon: LayoutGrid },
  { id: 'health', label: 'Health Data', icon: HeartPulse },
  { id: 'prediction', label: 'AI Prediction', icon: BrainCircuit },
  { id: 'rppg', label: 'Vitals Monitor', icon: Camera },
  { id: 'sources', label: 'Data Sources', icon: Link2 },
  { id: 'chat', label: 'Health AI', icon: MessageSquare },
] as const

export function ModernSidebar({ activeTab, onTabChange, isOpen = true, isCollapsed = false, onClose }: SidebarProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleTabChange = (tabId: TabType) => {
    onTabChange(tabId)
    if (onClose && typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose()
    }
  }

  // Pre-render a simplified version for SSR to ensure consistency
  if (!mounted) {
    return (
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen z-[1050] hidden lg:flex',
          'bg-sh-card border-r border-sh-border',
          'flex-col overflow-hidden',
          isCollapsed ? 'w-[80px]' : 'w-[280px]'
        )}
      >
        <div className={cn("flex items-center shrink-0", isCollapsed ? "p-4 justify-center h-[90px]" : "p-8 h-[100px]")}>
          <div className="w-11 h-11 rounded-[15px] bg-sh-green flex items-center justify-center shrink-0">
             <Activity className="w-6 h-6 text-white" />
          </div>
        </div>
      </aside>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && typeof window !== 'undefined' && window.innerWidth < 1024 && (
     <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[1040] lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          x: isOpen ? 0 : -280,
          opacity: isOpen ? 1 : 0 
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 30 
        }}
        className={cn(
          'fixed top-0 left-0 h-screen z-[1050] lg:flex',
          'bg-sh-card border-r border-sh-border',
          'flex-col overflow-hidden',
          'transition-all duration-400 cubic-bezier(0.32, 0.72, 0, 1)',
          isCollapsed ? 'w-[80px]' : 'w-[280px]',
          !isOpen && 'hidden lg:flex'
        )}
      >
        {/* Brand header */}
        <div className={cn("transition-all duration-400 flex items-center shrink-0", isCollapsed ? "p-4 justify-center h-[90px]" : "p-8 h-[100px]")}>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[15px] bg-sh-green flex items-center justify-center shadow-lg shadow-sh-green/20 shrink-0">
              <Activity className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col"
              >
                <h1 className="text-[21px] font-black text-sh-text tracking-tight leading-none">Sehati</h1>
                <p className="text-[9px] text-sh-sub font-bold uppercase tracking-[0.18em] -mt-1">Health AI</p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 scrollbar-hide py-2">
          <div className={cn("space-y-1", isCollapsed ? "items-center" : "")}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabType)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                    border: 'none',
                    padding: '0',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  title={isCollapsed ? tab.label : undefined}
                >
                  <div 
                    className={cn(
                      "flex items-center transition-all duration-300",
                      isCollapsed ? "justify-center w-full" : "w-full gap-3 px-3 py-1.5 rounded-[18px]"
                    )}
                    style={{
                      backgroundColor: isActive ? 'rgba(52, 199, 89, 0.12)' : 'transparent',
                    }}
                  >
                    <div className={cn(
                      "flex items-center justify-center transition-all duration-300 rounded-[14px] shrink-0",
                      isCollapsed ? "w-[48px] h-[48px]" : "w-[38px] h-[38px]",
                      isActive ? "bg-sh-green text-white shadow-md shadow-sh-green/25" : "bg-sh-bg text-sh-sub"
                    )}>
                      <Icon 
                        size={isCollapsed ? 24 : 20}
                        strokeWidth={isActive ? 2.5 : 2}
                        color={isActive ? "#FFFFFF" : "currentColor"}
                      />
                    </div>
                    {!isCollapsed && (
                      <span className={cn(
                        "text-[14px] transition-all",
                        isActive ? "font-bold text-sh-text" : "font-semibold text-sh-sub"
                      )}>
                        {tab.label}
                      </span>
                    )}
                  </div>
                  {isActive && isCollapsed && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute left-[-16px] w-1.5 h-8 bg-sh-green rounded-r-full" 
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="my-5 border-t border-sh-border opacity-30" />

          {/* Account section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-4 mb-2 text-[10px] font-bold text-sh-sub uppercase tracking-widest opacity-60">
                Account
              </p>
            )}
            
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                outline: 'none'
              }}
              title={isCollapsed ? (mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
            >
              <div className={cn(
                "flex items-center transition-all duration-300",
                isCollapsed ? "justify-center w-full" : "w-full gap-3 px-3 py-1.5 rounded-[18px]"
              )}>
                <div className={cn(
                  "flex items-center justify-center transition-all duration-300 rounded-[14px] bg-sh-bg shrink-0",
                  isCollapsed ? "w-[48px] h-[48px]" : "w-[38px] h-[38px]"
                )}>
                  {mounted && theme === 'dark' ? (
                    <Sun size={20} color="#34C759" />
                  ) : (
                    <Moon size={20} color="#007AFF" />
                  )}
                </div>
                {!isCollapsed && (
                  <span className="text-[14px] font-semibold text-sh-sub">
                    {mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                )}
              </div>
            </button>
            
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                padding: '0',
                cursor: 'pointer',
                outline: 'none'
              }}
              title={isCollapsed ? 'Logout' : undefined}
            >
              <div className={cn(
                "flex items-center transition-all duration-300",
                isCollapsed ? "justify-center w-full" : "w-full gap-3 px-3 py-1.5 rounded-[18px]"
              )}>
                <div className={cn(
                  "flex items-center justify-center transition-all duration-300 rounded-[14px] bg-sh-red/5 shrink-0",
                  isCollapsed ? "w-[48px] h-[48px]" : "w-[38px] h-[38px]"
                )}>
                  <LogOut size={20} color="#FF3B30" />
                </div>
                {!isCollapsed && (
                  <span className="text-[14px] font-semibold text-sh-sub">
                    Logout
                  </span>
                )}
              </div>
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className={cn("mt-auto border-t border-sh-border text-center transition-all pb-6 pt-4 shrink-0", isCollapsed ? "px-2" : "px-5")}>
          {!isCollapsed && (
            <p className="text-[9px] font-bold text-sh-sub uppercase tracking-widest mb-0.5">
              Moroccan AI
            </p>
          )}
          <p className={cn("text-sh-sub/40 font-bold", isCollapsed ? "text-[8px]" : "text-[9px]")}>
            &copy; {new Date().getFullYear()} Sehati
          </p>
        </div>
      </motion.aside>
    </>
  )
}
