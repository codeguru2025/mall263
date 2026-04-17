'use client';

import { useEffect, useState } from 'react';
import {
  formatOfferTimeLeft,
  offerExpiryUrgencyTier,
  offerRemainingMs,
  offerValidityRemainingFraction,
} from '@mall263/shared';

type Props = {
  createdAt: string;
  expiresAt: string;
  /** When true, pulse the bar in the last stretch */
  emphasize?: boolean;
};

export default function OfferExpiryBar({ createdAt, expiresAt, emphasize = true }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const fraction = offerValidityRemainingFraction(createdAt, expiresAt, now);
  const msLeft = offerRemainingMs(expiresAt, now);
  const tier = offerExpiryUrgencyTier(fraction);
  const pct = Math.max(0, Math.min(100, fraction * 100));

  const fill =
    tier === 'critical'
      ? 'bg-brand-red'
      : tier === 'high'
        ? 'bg-brand-orange'
        : 'bg-brand-blue';

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-gray-500">
        <span>Offer expires</span>
        <span className={tier === 'critical' ? 'text-brand-red' : tier === 'high' ? 'text-brand-orange' : 'text-brand-blue'}>
          {formatOfferTimeLeft(msLeft)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width,margin-left] duration-700 ease-linear ${fill} ${
            emphasize && tier === 'critical' ? 'animate-pulse' : ''
          }`}
          style={{ width: `${pct}%`, marginLeft: `${100 - pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Offer time remaining"
        />
      </div>
    </div>
  );
}
