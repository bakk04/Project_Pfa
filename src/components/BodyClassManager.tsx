'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function BodyClassManager() {
  const pathname = usePathname();

  useEffect(() => {
    const isProfile = pathname?.startsWith('/profile');
    
    if (isProfile) {
      document.body.classList.add('hold-transition', 'light-skin', 'sidebar-mini', 'theme-primary', 'profile-dashboard-active');
      document.body.classList.remove('index-page');
    } else {
      document.body.classList.add('index-page');
      document.body.classList.remove('hold-transition', 'light-skin', 'sidebar-mini', 'theme-primary', 'profile-dashboard-active');
    }
  }, [pathname]);

  return null;
}
