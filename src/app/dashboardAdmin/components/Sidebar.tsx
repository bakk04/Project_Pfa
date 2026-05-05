'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, isMobileOpen, onCloseMobile }) => {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('dashboard');

  const menuGroups = {
    dashboard: [
      { name: 'Real-time State', href: '/dashboardAdmin', icon: 'ph-chart-line-up' },
      { name: 'System Integrity', href: '/dashboardAdmin/system', icon: 'ph-shield-check' },
    ],
    users: [
      { name: 'Clinical Users', href: '/dashboardAdmin/users', icon: 'ph-user-list' },
      { name: 'Access Logs', href: '/dashboardAdmin/audit', icon: 'ph-clock-counter-clockwise' },
    ],
    ai: [
      { name: 'Model Registry', href: '/dashboardAdmin/ai', icon: 'ph-brain' },
      { name: 'Intelligence Lab', href: '/dashboardAdmin/lab', icon: 'ph-flask' },
    ]
  };

  const mainNavItems = [
    { id: 'dashboard', icon: 'ph-circles-four', label: 'Dashboard' },
    { id: 'users', icon: 'ph-users-four', label: 'User Control' },
    { id: 'ai', icon: 'ph-sparkle', label: 'AI Studio' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`two-col-sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'open' : ''}`}>
        <div className="flex h-full">
          {/* Left Navigation (Small Icons) */}
          <div className="sidebar-left bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800/60 py-6 flex flex-col items-center">
            <Link href="/dashboardAdmin" className="mb-6 transition-transform hover:scale-110">
              <div className="size-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                <i className="ph ph-activity text-2xl"></i>
              </div>
            </Link>

            <nav className="flex-grow flex flex-col gap-2">
              {mainNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`size-11 rounded-2xl flex items-center justify-center transition-all duration-300 relative group
                    ${activeTab === item.id 
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  title={item.label}
                >
                  <i className={`ph ${item.icon} text-2xl group-hover:scale-110 transition-transform`}></i>
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-600 rounded-l-full"
                    />
                  )}
                </button>
              ))}
            </nav>

            <div className="flex flex-col gap-4 mt-auto">
              <Link href="/" className="size-11 rounded-2xl flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-800/50 transition-all" title="Back to Site">
                <i className="ph ph-house text-2xl"></i>
              </Link>
              <button 
                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                className="size-11 rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all" 
                title="Sign Out"
              >
                <i className="ph ph-sign-out text-2xl"></i>
              </button>
            </div>
          </div>

          {/* Right Navigation (Detailed Menu) */}
          <div className="sidebar-right bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 overflow-hidden">
            <div className="sidebar-logo mb-10 px-2 flex items-center justify-between">
              <span className="text-[20px] font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                SEHATI<span className="text-emerald-600">.AI</span>
              </span>
            </div>

            <div className="h-full flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex-grow"
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black mb-6 px-3">
                    {activeTab === 'dashboard' ? 'Analytics Hub' : activeTab === 'users' ? 'Administration' : 'AI Ecosystem'}
                  </p>
                  
                  <ul className="space-y-1">
                    {menuGroups[activeTab as keyof typeof menuGroups].map((item) => (
                      <li key={item.href}>
                        <Link 
                          href={item.href} 
                          className={`flex items-center px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all
                            ${pathname === item.href 
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' 
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>

              {/* Version/Plan Badge - Simplified */}
              <div className="mt-auto pb-6 px-3">
                <div className="flex items-center gap-2 py-2 px-1">
                  <div className="size-1.5 rounded-full bg-emerald-500"></div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">Enterprise v2.4</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
