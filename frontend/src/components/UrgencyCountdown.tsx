'use client';

import { useEffect, useState, useMemo } from 'react';

interface UrgencyCountdownProps {
  expiresAt: string | Date;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  isExpired: boolean;
}

function computeTimeLeft(endTime: number): TimeLeft {
  const now = Date.now();
  const total = endTime - now;
  if (!Number.isFinite(endTime) || total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true };
  }
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((total % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, total, isExpired: false };
}

const urgencyConfig = {
  URGENT: {
    color: 'text-brand-red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    pulse: true,
    weight: 100,
  },
  HIGH: {
    color: 'text-brand-orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    pulse: false,
    weight: 75,
  },
  MEDIUM: {
    color: 'text-brand-blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    pulse: false,
    weight: 50,
  },
  LOW: {
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    pulse: false,
    weight: 25,
  },
};

export function useCountdown(expiresAt: string | Date): TimeLeft {
  const endTime = useMemo(() => {
    const t = new Date(expiresAt).getTime();
    return Number.isFinite(t) ? t : 0;
  }, [expiresAt]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => computeTimeLeft(endTime));

  useEffect(() => {
    setTimeLeft(computeTimeLeft(endTime));
    const timer = setInterval(() => {
      const remaining = computeTimeLeft(endTime);
      setTimeLeft(remaining);
      if (remaining.isExpired) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  return timeLeft;
}

export function formatCountdown(timeLeft: TimeLeft, compact = false): string {
  if (timeLeft.isExpired) return 'Expired';
  
  const { days, hours, minutes, seconds } = timeLeft;
  
  if (compact) {
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours.toString().padStart(2, '0')}h`);
  parts.push(`${minutes.toString().padStart(2, '0')}m`);
  parts.push(`${seconds.toString().padStart(2, '0')}s`);
  
  return parts.join(' ');
}

export default function UrgencyCountdown({ 
  expiresAt, 
  urgency, 
  size = 'md',
  showIcon = true 
}: UrgencyCountdownProps) {
  const timeLeft = useCountdown(expiresAt);
  const config = urgencyConfig[urgency];
  
  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };
  
  const getUrgencyLevel = (): 'critical' | 'high' | 'medium' | 'low' => {
    if (timeLeft.isExpired) return 'critical';
    if (timeLeft.total < 3600000) return 'critical'; // < 1 hour
    if (timeLeft.total < 86400000) return 'high'; // < 24 hours
    if (timeLeft.total < 259200000) return 'medium'; // < 3 days
    return 'low';
  };
  
  const level = getUrgencyLevel();
  
  const levelStyles = {
    critical: 'bg-red-100 text-brand-red border-red-300 animate-pulse',
    high: 'bg-orange-100 text-brand-orange border-orange-300',
    medium: config.bgColor + ' ' + config.color + ' ' + config.borderColor,
    low: config.bgColor + ' ' + config.color + ' ' + config.borderColor,
  };
  
  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 font-bold rounded-lg border
        ${sizeClasses[size]}
        ${levelStyles[level]}
        ${config.pulse && level === 'critical' ? 'animate-pulse' : ''}
      `}
      title={`Expires: ${new Date(expiresAt).toLocaleString()}`}
    >
      {showIcon && (
        <svg 
          className="w-3 h-3" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      )}
      <span>{formatCountdown(timeLeft, true)}</span>
    </span>
  );
}

// Export urgency weight for ranking algorithm
export function getUrgencyWeight(urgency: string): number {
  return urgencyConfig[urgency as keyof typeof urgencyConfig]?.weight || 25;
}
