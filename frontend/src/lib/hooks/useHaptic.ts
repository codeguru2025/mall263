import { useCallback } from 'react';

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* no-op */ }
  }
}

export function useHaptic() {
  const light = useCallback(() => vibrate(10), []);
  const medium = useCallback(() => vibrate(25), []);
  const heavy = useCallback(() => vibrate(50), []);
  return { light, medium, heavy };
}
