'use client';

import { useEffect } from 'react';

interface StyleSheetLoaderProps {
  hrefs: string[];
}

export default function StyleSheetLoader({ hrefs }: StyleSheetLoaderProps) {
  useEffect(() => {
    const links = hrefs.map(href => {
      if (document.querySelector(`link[href="${href}"]`)) return null;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      return link;
    });

    return () => {
      links.forEach(link => {
        if (link && document.head.contains(link)) {
          // document.head.removeChild(link); 
          // Keep it to avoid flickering on navigation if needed, 
          // but removing it is cleaner for scoped layouts.
        }
      });
    };
  }, [hrefs]);

  return null;
}
