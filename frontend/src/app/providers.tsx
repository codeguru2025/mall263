'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/store';
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus';
import { useSwipeBack } from '@/lib/hooks/useSwipeBack';
import BottomNav from '@/components/BottomNav';
import PwaServiceWorkerRegister from '@/components/PwaServiceWorkerRegister';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import FloatingRefreshButton from '@/components/FloatingRefreshButton';
import { WifiOff } from 'lucide-react';

function AuthLoader({ children }: { children: React.ReactNode }) {
  const loadUser = useAuthStore((s) => s.loadUser);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-navy-700 font-bold">Loading Mall263...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-gray-800 text-white text-center text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 overflow-hidden z-[60] relative"
        >
          <WifiOff className="w-3.5 h-3.5" />
          You&apos;re offline — changes will sync when reconnected
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SwipeBackProvider({ children }: { children: React.ReactNode }) {
  useSwipeBack();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: (failureCount, error: any) => {
              if (error?.response?.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PwaServiceWorkerRegister />
      <AuthLoader>
        <SwipeBackProvider>
          <OfflineBanner />
          <PageTransition>
            {children}
          </PageTransition>
          <BottomNav />
          <FloatingRefreshButton />
          <PWAInstallPrompt />
        </SwipeBackProvider>
      </AuthLoader>
      <Toaster
        position="top-center"
        toastOptions={{ duration: 3000 }}
        containerStyle={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      />
    </QueryClientProvider>
  );
}
