'use client';

import { useEffect } from 'react';

/**
 * SafariDetector - Handles Safari-specific header fixes
 * - Re-confirms Safari detection
 * - Measures header height
 * - Sets CSS variable --header-h
 * - Adds body.safari-pad for fixed header spacing
 */
export default function SafariDetector() {
  useEffect(() => {
    // Re-confirm Safari detection (in case script in head didn't run)
    const ua = navigator.userAgent.toLowerCase();
    const isSafari = ua.includes('safari') && !ua.includes('chrome');
    
    if (isSafari) {
      document.documentElement.classList.add('safari');
      
      // Measure header height and set CSS variable
      const measureHeader = () => {
        const header = document.querySelector('header.site-header');
        if (header) {
          const height = header.getBoundingClientRect().height;
          document.documentElement.style.setProperty('--header-h', `${height}px`);
          
          // Add body padding for fixed header on mobile
          if (window.innerWidth < 768) {
            document.body.classList.add('safari-pad');
          } else {
            document.body.classList.remove('safari-pad');
          }
        }
      };
      
      // Measure on mount
      measureHeader();
      
      // Re-measure on resize (header height might change)
      const handleResize = () => {
        measureHeader();
      };
      
      window.addEventListener('resize', handleResize);
      
      // Also measure after a short delay to catch any layout shifts
      const timeoutId = setTimeout(measureHeader, 100);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        clearTimeout(timeoutId);
      };
    }
  }, []);

  return null;
}

