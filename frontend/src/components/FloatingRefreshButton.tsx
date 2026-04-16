'use client';

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHaptic } from '@/lib/hooks/useHaptic';

const LONG_PRESS_MS = 900;

/**
 * Floating refresh: tap / click = refetch cached API data + Next router refresh + SW update check.
 * Hold ~1s = full page reload (latest JS bundle / PWA).
 */
export default function FloatingRefreshButton() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const haptic = useHaptic();
  const [busy, setBusy] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const skipNextClick = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const softRefresh = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    haptic.light();
    const id = toast.loading('Refreshing…');
    try {
      await queryClient.invalidateQueries();
      router.refresh();
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }
      toast.success('Up to date', { id });
    } catch {
      toast.error('Could not refresh', { id });
    } finally {
      setBusy(false);
    }
  }, [busy, queryClient, router, haptic]);

  const startLongPress = useCallback(() => {
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      clearLongPress();
      toast('Reloading app…', { duration: 1500 });
      window.location.reload();
    }, LONG_PRESS_MS);
  }, [clearLongPress]);

  const endPointer = useCallback(() => {
    clearLongPress();
    if (!longPressTriggered.current) {
      skipNextClick.current = true;
      void softRefresh();
    }
  }, [clearLongPress, softRefresh]);

  return (
    <button
      type="button"
      aria-label="Refresh data. Hold about one second to reload the app."
      title="Tap: fresh data · Hold: reload app"
      disabled={busy}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        startLongPress();
      }}
      onPointerUp={endPointer}
      onPointerLeave={() => {
        clearLongPress();
      }}
      onPointerCancel={() => {
        clearLongPress();
      }}
      onClick={() => {
        if (skipNextClick.current) {
          skipNextClick.current = false;
          return;
        }
        void softRefresh();
      }}
      className="fixed bottom-[5.5rem] right-4 z-[9997] flex h-12 w-12 items-center justify-center rounded-full border border-navy-700/10 bg-white text-navy-700 shadow-lg shadow-navy-900/15 transition hover:bg-gray-50 active:scale-95 disabled:opacity-60 sm:bottom-24"
    >
      <RefreshCw className={`h-5 w-5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
    </button>
  );
}
