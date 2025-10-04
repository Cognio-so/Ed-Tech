'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function WeglotWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    // Wait for Weglot to be available and then refresh translations
    const refreshWeglot = () => {
      if (typeof window !== 'undefined' && window.Weglot) {
        try {
          window.Weglot.refresh();
          console.log('🔄 Weglot refreshed for route:', pathname);
        } catch (error) {
          console.warn('⚠️ Error refreshing Weglot:', error);
        }
      } else {
        // Retry after a short delay if Weglot isn't ready yet
        setTimeout(refreshWeglot, 100);
      }
    };

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(refreshWeglot, 50);
    
    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}
