'use client';

import React, { useState } from 'react';
import './dashboard.css';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import StyleSheetLoader from '@/components/StyleSheetLoader';

const inter = Inter({ subsets: ['latin'] });

export default function DashboardAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const externalStyles = [
    "/dashboardAdmin/assets/libs/@phosphor-icons/web/duotone/style.css",
    "/dashboardAdmin/assets/libs/@phosphor-icons/web/regular/style.css",
    "/dashboardAdmin/assets/libs/@phosphor-icons/web/fill/style.css",
    "/dashboardAdmin/assets/libs/lucide-static/font/lucide.css",
    "/dashboardAdmin/assets/libs/simplebar/simplebar.min.css",
    "/dashboardAdmin/assets/libs/flatpickr/flatpickr.min.css"
  ];

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <div className={`dashboard-admin-root ${inter.className}`}>
        <StyleSheetLoader hrefs={externalStyles} />

        <div className="flex min-h-screen overflow-x-hidden">
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            isMobileOpen={isMobileMenuOpen} 
            onCloseMobile={() => setIsMobileMenuOpen(false)} 
          />
          
          <div className={`main-wrapper ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            <Topbar 
              onToggleSidebar={toggleSidebar} 
              onToggleMobile={toggleMobileMenu}
              isSidebarCollapsed={isSidebarCollapsed}
            />
            <main className="page-content">
              {children}
            </main>
          </div>
        </div>

        {/* Global UI Components */}
        <Toaster position="top-right" richColors />

        {/* Scripts */}
        <Script src="/dashboardAdmin/assets/libs/jquery/jquery.min.js" strategy="beforeInteractive" />
        <Script src="/dashboardAdmin/assets/libs/simplebar/simplebar.min.js" strategy="afterInteractive" />
        <Script src="/dashboardAdmin/assets/libs/preline/preline.js" strategy="afterInteractive" />
      </div>
    </ThemeProvider>
  );
}
