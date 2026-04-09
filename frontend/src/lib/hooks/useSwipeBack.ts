'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useSwipeBack() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      if (touch.clientX <= 20) {
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dx > 100 && dy < 80) {
        if (window.history.length > 1) {
          router.back();
        }
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [router]);
}
