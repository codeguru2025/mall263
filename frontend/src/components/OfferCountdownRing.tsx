'use client';

import { useEffect, useState } from 'react';
import {
  formatOfferTimeLeft,
  offerExpiryUrgencyTier,
  offerRemainingMs,
  offerValidityRemainingFraction,
} from '@mall263/shared';

const SIZE = 64;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

type Props = {
  createdAt: string;
  expiresAt: string;
};

export default function OfferCountdownRing({ createdAt, expiresAt }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const fraction = offerValidityRemainingFraction(createdAt, expiresAt, now);
  const msLeft = offerRemainingMs(expiresAt, now);
  const tier = offerExpiryUrgencyTier(fraction);
  const pct = Math.max(0, Math.min(1, fraction));

  const ringColor =
    tier === 'critical' ? '#ef4444' : tier === 'high' ? '#f97316' : '#16a34a';
  const trackColor =
    tier === 'critical' ? '#fee2e2' : tier === 'high' ? '#ffedd5' : '#dcfce7';

  const dashOffset = CIRCUMFERENCE * (1 - pct);
  const timeLabel = formatOfferTimeLeft(msLeft);

  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0"
        aria-hidden="true"
      >
        {/* Track ring */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={trackColor}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Progress arc — 12 o'clock start, depletes clockwise */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={ringColor}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.5s ease' }}
        />
      </svg>
      {/* Centre text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[10px] font-black leading-none text-center"
          style={{ color: ringColor, maxWidth: SIZE - 14 }}
        >
          {timeLabel}
        </span>
      </div>
    </div>
  );
}
