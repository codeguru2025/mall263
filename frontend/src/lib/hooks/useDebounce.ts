import { useState, useEffect, useRef, useCallback } from 'react';

export function useDebounce(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay = 300,
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => cancel, [cancel]);

  return useCallback(
    (...args: Parameters<T>) => {
      cancel();
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay, cancel],
  );
}
