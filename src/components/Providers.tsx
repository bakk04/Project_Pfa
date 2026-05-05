'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from './theme-provider';
import React from 'react';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children, session }: { children: React.ReactNode; session?: any }) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </SessionProvider>
  );
}
