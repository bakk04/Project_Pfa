'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';

interface TopbarProps {
  onToggleSidebar: () => void;
  onToggleMobile: () => void;
  isSidebarCollapsed: boolean;
}

const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, onToggleMobile, isSidebarCollapsed }) => {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="navbar-header">
      <div className="flex items-center justify-between w-full h-full gap-6">
        <div className="flex items-center gap-5">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={onToggleMobile}
            className="lg:hidden size-10 flex items-center justify-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50 hover:text-emerald-600 transition-all shadow-sm"
          >
            <i className="ph ph-list text-xl"></i>
          </button>

          {/* Desktop Sidebar Toggle */}
          <button 
            onClick={onToggleSidebar}
            className="hidden lg:flex size-9 items-center justify-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50 hover:text-emerald-600 transition-all shadow-sm group"
          >
            <i className={`ph ${isSidebarCollapsed ? 'ph-caret-right' : 'ph-caret-left'} text-base transition-transform group-active:scale-90`}></i>
          </button>

          <div className="header-search hidden md:block">
            <div className="relative group">
              <span className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none">
                <i className="ph ph-magnifying-glass text-slate-400 group-focus-within:text-emerald-500 transition-colors text-base"></i>
              </span>
              <input 
                type="text" 
                className="ps-10 pe-12 h-9 w-64 lg:w-80 bg-slate-100/50 dark:bg-slate-900 border-none text-slate-900 dark:text-white rounded-xl focus:bg-white dark:focus:bg-slate-800 placeholder:text-slate-400 transition-all text-[11px] font-medium outline-none shadow-sm" 
                placeholder="Search records or AI..." 
                autoComplete="off" 
              />
              <div className="absolute end-3 top-1/2 -translate-y-1/2 flex gap-1 opacity-30 group-focus-within:opacity-100 transition-opacity">
                <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm">⌘</kbd>
                <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm">K</kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Stats Overlay */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-lg">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Live</span>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>

          {/* Theme Toggle */}
          <button 
            className="size-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800" 
            type="button"
            onClick={toggleTheme}
            title="Toggle Visual Mode"
          >
            <motion.i 
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              className={`ph ${theme === 'dark' ? 'ph-sun' : 'ph-moon-stars'} text-lg`}
            ></motion.i>
          </button>

          {/* User Profile */}
          <div className="hs-dropdown [--placement:bottom-right] relative ml-1">
            <button className="hs-dropdown-toggle flex items-center gap-2 p-1.5 rounded-full border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md transition-all hover:bg-white dark:hover:bg-slate-800 group shadow-sm hover:shadow-md" aria-haspopup="menu" aria-expanded="false">
              <div className="relative">
                <div className="size-7 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-[9px] shadow-sm">
                  {session?.user?.name?.split(' ').map(n => n[0]).join('') || 'AD'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800">
                  <div className="size-1.5 rounded-full bg-emerald-500"></div>
                </div>
              </div>
              <div className="text-left hidden sm:block px-1">
                <p className="text-[10px] font-black text-slate-900 dark:text-white leading-none mb-0.5">{session?.user?.name?.split(' ')[0] || 'Admin'}</p>
                <p className="text-[7px] text-slate-400 font-black uppercase tracking-tighter leading-none">Clinical Lead</p>
              </div>
              <i className="ph ph-dots-three-vertical text-slate-400 group-hover:text-emerald-600 transition-colors ms-1"></i>
            </button>
            
            <div className="hs-dropdown-menu transition-[opacity,margin] duration hs-dropdown-open:opacity-100 opacity-0 hidden min-w-[200px] p-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-2xl rounded-2xl mt-4 z-50 overflow-hidden" role="menu">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800/60 mb-2 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                <p className="font-black text-[11px] text-slate-900 dark:text-white truncate mb-0.5">{session?.user?.name || 'Admin User'}</p>
                <p className="text-[9px] text-slate-400 font-medium truncate">{session?.user?.email || 'admin@sehati.ai'}</p>
              </div>
              <div className="space-y-0.5 px-1">
                <Link href="/profile" className="flex items-center px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 transition-colors text-[10px] font-bold">
                  <i className="ph ph-user-circle text-base me-3"></i>Clinical Profile
                </Link>
                <Link href="/dashboardAdmin/settings" className="flex items-center px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 transition-colors text-[10px] font-bold">
                  <i className="ph ph-gear text-base me-3"></i>System Configuration
                </Link>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800/60 mt-2 pt-2 px-1">
                <button 
                  onClick={() => signOut({ callbackUrl: '/auth/login' })}
                  className="w-full flex items-center px-3 py-2 rounded-lg text-[10px] font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  <i className="ph ph-power text-base me-3"></i>Terminate Session
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Topbar;
