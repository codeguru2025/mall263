'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Gavel, MapPin, Clock, Star, TrendingUp, AlertCircle } from 'lucide-react';
import UrgencyCountdown, { getUrgencyWeight } from './UrgencyCountdown';
import { formatCurrency } from '@/lib/utils';

export interface DemandCardProps {
  demand: {
    id: string;
    title: string;
    description?: string | null;
    maxBudget: string | number;
    minBudget?: string | number | null;
    currency: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status: string;
    expiresAt: string;
    createdAt: string;
    score?: number;
    rank?: number;
    timeRemainingHours?: number;
    offerCount?: number;
    distanceKm?: number;
    buyer: {
      id: string;
      firstName: string;
      lastName?: string | null;
      avatarUrl?: string | null;
      trustScore?: {
        overallScore?: string | number | null;
      } | null;
    };
  };
  showRank?: boolean;
  showScore?: boolean;
  priority?: boolean;
}

const urgencyColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  URGENT: {
    bg: 'bg-red-50',
    text: 'text-brand-red',
    border: 'border-red-200',
    label: 'URGENT',
  },
  HIGH: {
    bg: 'bg-orange-50',
    text: 'text-brand-orange',
    border: 'border-orange-200',
    label: 'HIGH',
  },
  MEDIUM: {
    bg: 'bg-blue-50',
    text: 'text-brand-blue',
    border: 'border-blue-200',
    label: 'MEDIUM',
  },
  LOW: {
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: 'border-gray-200',
    label: 'LOW',
  },
};

export default function DemandCard({ 
  demand, 
  showRank = false, 
  showScore = false,
  priority = false 
}: DemandCardProps) {
  const urgencyStyle = urgencyColors[demand.urgency] || urgencyColors.MEDIUM;
  const trustScore = demand.buyer?.trustScore?.overallScore 
    ? parseFloat(String(demand.buyer.trustScore.overallScore))
    : 50;

  const getRankBadge = () => {
    if (!demand.rank) return null;
    if (demand.rank === 1) return { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: '🥇' };
    if (demand.rank === 2) return { color: 'bg-gray-100 text-gray-600 border-gray-300', icon: '🥈' };
    if (demand.rank === 3) return { color: 'bg-orange-50 text-orange-600 border-orange-300', icon: '🥉' };
    return { color: 'bg-gray-50 text-gray-500 border-gray-200', icon: `#${demand.rank}` };
  };

  const rankBadge = getRankBadge();

  return (
    <Link href={`/demands/${demand.id}`}>
      <div 
        className={`
          bg-white rounded-2xl border-2 p-4 transition-all hover:shadow-md cursor-pointer
          ${priority ? 'border-brand-orange' : 'border-gray-100'}
          ${demand.urgency === 'URGENT' ? 'ring-2 ring-red-100' : ''}
        `}
      >
        {/* Header with rank, urgency, and countdown */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {showRank && rankBadge && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${rankBadge.color}`}>
                {rankBadge.icon}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${urgencyStyle.bg} ${urgencyStyle.text} border ${urgencyStyle.border}`}>
              {urgencyStyle.label}
            </span>
            <UrgencyCountdown 
              expiresAt={demand.expiresAt} 
              urgency={demand.urgency}
              size="sm"
            />
          </div>
          {showScore && demand.score !== undefined && (
            <span className="flex items-center gap-1 text-xs font-bold text-brand-green bg-green-50 px-2 py-0.5 rounded-lg">
              <TrendingUp className="w-3 h-3" />
              {demand.score.toFixed(0)}
            </span>
          )}
        </div>

        {/* Buyer info */}
        <div className="flex items-center gap-3 mb-3">
          {demand.buyer?.avatarUrl ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden relative flex-shrink-0">
              <Image 
                src={demand.buyer.avatarUrl} 
                alt={demand.buyer.firstName} 
                fill 
                className="object-cover" 
                sizes="40px"
              />
            </div>
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-brand-blue to-brand-green rounded-xl flex items-center justify-center flex-shrink-0">
              <Gavel className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-navy-700 text-sm truncate">
              {demand.buyer.firstName} {demand.buyer.lastName}
            </p>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Star className="w-3 h-3" />
              <span>Trust: {trustScore.toFixed(0)}/100</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-black text-navy-700 text-base leading-tight mb-2 line-clamp-2">
          {demand.title}
        </h3>

        {demand.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{demand.description}</p>
        )}

        {/* Budget and offers */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 rounded-xl p-2.5">
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Budget</p>
            <p className="font-black text-navy-700 text-sm">
              {demand.minBudget && parseFloat(String(demand.minBudget)) > 0 
                ? `${formatCurrency(parseFloat(String(demand.minBudget)))} - `
                : 'Up to '
              }
              {formatCurrency(parseFloat(String(demand.maxBudget)))}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2.5">
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Offers</p>
            <p className="font-black text-navy-700 text-sm">
              {demand.offerCount ?? 0} received
            </p>
          </div>
        </div>

        {/* Footer: Distance and time */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            {demand.distanceKm !== undefined && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {demand.distanceKm.toFixed(1)} km
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(demand.createdAt).toLocaleDateString()}
            </span>
          </div>
          {demand.offerCount === 0 && (
            <span className="flex items-center gap-1 text-brand-green font-bold">
              <AlertCircle className="w-3 h-3" />
              Be first!
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
