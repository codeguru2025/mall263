'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import api from '@/lib/api';

interface Ad {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  placement: string;
}

interface AdBannerProps {
  placement: 'BANNER_TOP' | 'BANNER_BOTTOM' | 'SIDEBAR';
  role?: string;
  className?: string;
}

export function AdBanner({ placement, role, className = '' }: AdBannerProps) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    api
      .get('/api/v1/ads/active', { params: { placement, ...(role ? { role } : {}) } })
      .then((r) => {
        const ads: Ad[] = r.data ?? [];
        const match = ads.find((a) => a.placement === placement);
        if (match) setAd(match);
      })
      .catch(() => {});
  }, [placement, role]);

  useEffect(() => {
    if (ad && !reported.current) {
      reported.current = true;
      api.post(`/api/v1/ads/${ad.id}/impression`).catch(() => {});
    }
  }, [ad]);

  if (!ad || dismissed) return null;

  const inner = (
    <div className={`relative rounded-xl overflow-hidden ${className}`}>
      {ad.imageUrl ? (
        <div className="relative w-full h-20 sm:h-24">
          <Image
            src={ad.imageUrl}
            alt={ad.title}
            fill
            className="object-cover"
            sizes="(max-width:640px) 100vw, 700px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
          <span className="absolute bottom-2 left-3 text-white text-xs font-black drop-shadow">
            {ad.title}
          </span>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-black text-navy-700">{ad.title}</p>
          </div>
        </div>
      )}
      {/* Ad label */}
      <span className="absolute top-1.5 right-8 text-[9px] font-bold text-white/80 bg-black/35 px-1.5 py-0.5 rounded-sm uppercase tracking-wide pointer-events-none">
        Ad
      </span>
      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDismissed(true);
        }}
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/35 flex items-center justify-center hover:bg-black/55 transition-colors"
        aria-label="Dismiss ad"
      >
        <X className="w-2.5 h-2.5 text-white" />
      </button>
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }

  return inner;
}
