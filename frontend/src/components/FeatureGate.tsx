'use client';

import { useState } from 'react';
import { useSubscription } from '@/lib/useSubscription';
import { useAuthStore } from '@/lib/store';
import SubscribeModal from './SubscribeModal';
import { Lock } from 'lucide-react';

interface FeatureGateProps {
  children: React.ReactNode;
  /** Show a lock overlay instead of hiding children entirely */
  overlay?: boolean;
}

/**
 * Wraps seller-only features. If the user's subscription has lapsed,
 * renders a subscribe prompt instead of the feature.
 * During trial or active subscription, renders children normally.
 */
export default function FeatureGate({ children, overlay = false }: FeatureGateProps) {
  const user = useAuthStore((s) => s.user);
  const { fullyAccess, isLoading } = useSubscription();
  const [showModal, setShowModal] = useState(false);

  // Only gate sellers (buyers don't need a subscription)
  const isSeller = user ? ['STALL_OWNER', 'ATTENDANT'].includes(user.role) : false;

  // Don't gate non-sellers, admins, or while loading
  if (!isSeller || isLoading || fullyAccess) {
    return <>{children}</>;
  }

  if (overlay) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-30 select-none">{children}</div>
        <button
          onClick={() => setShowModal(true)}
          className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-2xl gap-2"
        >
          <div className="w-10 h-10 bg-navy-700 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-black text-navy-700">Subscribe to unlock</span>
          <span className="text-xs text-gray-500">$5/month</span>
        </button>
        {showModal && <SubscribeModal onClose={() => setShowModal(false)} />}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex flex-col items-center justify-center gap-2 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl py-10 hover:border-navy-300 transition-colors"
      >
        <div className="w-12 h-12 bg-navy-700 rounded-full flex items-center justify-center">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <span className="font-black text-navy-700">Subscribe to use this feature</span>
        <span className="text-sm text-gray-400">$5/month · EcoCash</span>
      </button>
      {showModal && <SubscribeModal onClose={() => setShowModal(false)} />}
    </>
  );
}
