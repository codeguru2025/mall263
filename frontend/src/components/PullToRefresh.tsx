'use client';

import { ReactNode, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  className?: string;
}

export default function PullToRefresh({ children, onRefresh, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    tracking.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!tracking.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPulling(true);
      setPullDistance(Math.min(dy * 0.5, 120));
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!tracking.current) return;
    tracking.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      try { await onRefresh(); } finally { setRefreshing(false); }
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto overscroll-y-contain ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <AnimatePresence>
        {(pulling || refreshing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: refreshing ? 48 : pullDistance, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="flex items-center justify-center overflow-hidden"
          >
            <motion.div
              animate={refreshing ? { rotate: 360 } : { rotate: pullDistance * 2 }}
              transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { type: 'spring' }}
            >
              <RefreshCw className={`w-5 h-5 ${pullDistance >= threshold || refreshing ? 'text-brand-orange' : 'text-gray-300'}`} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
