'use client';

import { useEffect } from 'react';

/**
 * Registers a minimal service worker in production so Chrome/Android can treat
 * Mall263 as an installable PWA (manifest + SW + HTTPS).
 */
export default function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Non-fatal: install prompt fallback UI still works on many browsers.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
