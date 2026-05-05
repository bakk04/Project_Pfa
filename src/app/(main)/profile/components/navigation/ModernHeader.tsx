'use client'

import React, { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Menu,
  Search,
  Bell,
  Moon,
  Sun,
  Maximize,
  ChevronDown,
  User,
  LogOut,
  Settings,
  Activity
} from 'lucide-react'
import Image from 'next/image'

interface ModernHeaderProps {
  onToggleSidebar: () => void
  isSidebarCollapsed?: boolean
}

export function ModernHeader({ onToggleSidebar, isSidebarCollapsed }: ModernHeaderProps) {
  const { data: session } = useSession()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const user = session?.user
  // Don't wait for mounted for the basic image/name if session is present
  const hasImage = !!user?.image
  const currentTheme = mounted ? resolvedTheme : 'light'

  const getInitial = (name?: string | null) => 
    name ? name.trim().charAt(0).toUpperCase() : '?'

  const toggleFullscreen = () => {
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
      } else {
        document.exitFullscreen()
      }
    }
  }

  // Pre-render a stable version for SSR
  if (!mounted) {
    return (
      <header
        className={cn(
          'fixed top-0 right-0 h-[70px]',
          'bg-sh-bg/80 backdrop-blur-2xl border-b border-sh-border',
          'flex items-center justify-between px-6 lg:px-8',
          isSidebarCollapsed ? 'left-[80px]' : 'left-0 lg:left-[280px]',
          'z-[1200]'
        )}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2.5 rounded-2xl border border-sh-border bg-sh-card">
            <Menu className="w-5 h-5 text-sh-text" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-full bg-sh-bg border border-sh-border" />
        </div>
      </header>
    )
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-[70px]',
        'bg-sh-bg/80 backdrop-blur-2xl',
        'border-b border-sh-border',
        'flex items-center justify-between px-6 lg:px-8',
        'transition-all duration-400 cubic-bezier(0.32, 0.72, 0, 1)',
        isSidebarCollapsed ? 'left-[80px]' : 'left-0 lg:left-[280px]',
        'z-[1200]'
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className={cn(
            'p-2.5 rounded-2xl transition-all active:scale-95 hover:bg-sh-bg shadow-sm shrink-0',
            'text-sh-text border border-sh-border bg-sh-card !p-2.5'
          )}
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-sh-text" />
        </button>

        {/* Desktop Search */}
        <div className="hidden lg:flex items-center ml-2 max-w-md w-full">
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-sh-sub group-focus-within:text-sh-green transition-colors" />
            <input
              type="search"
              placeholder="Search health metrics..."
              className={cn(
                'w-full pl-10 pr-6 py-2.5 rounded-[18px]',
                'bg-sh-bg/50 border border-sh-border',
                'text-[14px] text-sh-text placeholder:text-sh-sub/60',
                'shadow-sm focus:shadow-md focus:ring-2 focus:ring-sh-green/20 focus:border-sh-green/30',
                'transition-all duration-300 outline-none focus:bg-sh-card'
              )}
            />
          </div>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
          className="sh-header-btn"
          aria-label="Toggle theme"
        >
          {mounted ? (
            currentTheme === 'dark' ? (
              <Sun size={22} color="#34C759" style={{ display: 'block' }} />
            ) : (
              <Moon size={22} color="#007AFF" style={{ display: 'block' }} />
            )
          ) : (
            <div style={{ width: '22px', height: '22px' }} /> 
          )}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="sh-header-btn"
            aria-label="Notifications"
          >
            <Bell size={22} color="var(--sh-text-main)" style={{ display: 'block' }} />
            <span style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#FF3B30',
              border: '2px solid var(--sh-card-bg)',
              zIndex: 10
            }} />
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsNotificationsOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  className={cn(
                    'absolute right-0 mt-4 w-80 z-20',
                    'bg-sh-card rounded-[28px]',
                    'border border-sh-border shadow-sh-hover',
                    'overflow-hidden'
                  )}
                >
                  <div className="p-6 border-b border-sh-border">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sh-text">Notifications</h3>
                      <button className="text-xs font-bold text-sh-green hover:underline bg-transparent border-none p-0">
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="p-4 max-h-[400px] overflow-y-auto">
                    <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-sh-bg/50 transition-colors cursor-pointer group">
                      <div className="w-10 h-10 rounded-full bg-sh-green/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Bell className="w-5 h-5 text-sh-green" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-sh-text">Welcome to Sehati</p>
                        <p className="text-xs text-sh-sub mt-1 leading-relaxed">
                          Your AI-powered health journey begins here. Start scanning your vitals.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={cn(
              'h-[42px] px-2 rounded-full flex items-center gap-2 transition-all active:scale-95',
              'bg-sh-card hover:bg-sh-bg shadow-sm border border-sh-border overflow-hidden'
            )}
          >
            {hasImage ? (
              <Image
                src={user!.image!}
                alt="User avatar"
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-sh-green flex items-center justify-center border border-sh-card">
                <span className="text-[10px] font-bold text-white">
                  {mounted ? getInitial(user?.name) : '?'}
                </span>
              </div>
            )}
            <span className="hidden sm:block text-[13px] font-bold text-sh-text pr-1">
              {mounted ? (user?.name?.split(' ')[0] || 'User') : '...'}
            </span>
          </button>

          <AnimatePresence>
            {isUserMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsUserMenuOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  className={cn(
                    'absolute right-0 mt-3 w-[260px] z-20',
                    'bg-sh-card rounded-[28px]',
                    'border border-sh-border shadow-sh-hover',
                    'overflow-hidden p-2'
                  )}
                >
                  <div className="px-4 py-3 border-b border-sh-border mx-2 mb-2">
                    <p className="text-[16px] font-bold text-sh-text leading-tight">
                      {mounted ? (user?.name || 'User') : '...'}
                    </p>
                    <p className="text-[11px] text-sh-sub font-bold uppercase tracking-wider mt-1">
                      Member
                    </p>
                  </div>
                  <div className="space-y-1">
                    <button
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl',
                        'text-[15px] font-semibold text-sh-text',
                        'hover:bg-sh-bg transition-colors'
                      )}
                    >
                      <User className="w-5 h-5 text-sh-sub" />
                      Profile
                    </button>
                    <button
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl',
                        'text-[15px] font-semibold text-sh-text',
                        'hover:bg-sh-bg transition-colors'
                      )}
                    >
                      <Settings className="w-5 h-5 text-sh-sub" />
                      Settings
                    </button>
                    <div className="my-2 border-t border-sh-border mx-2" />
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl',
                        'text-[15px] font-bold text-sh-red',
                        'hover:bg-sh-red/10 transition-colors'
                      )}
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
