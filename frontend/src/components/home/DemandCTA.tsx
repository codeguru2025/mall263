'use client';

import Link from 'next/link';
import { Gavel, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export default function DemandCTA() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Hide for sellers — they don't post demands
  if (user && ['STALL_OWNER', 'ATTENDANT'].includes(user.role)) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-2">
      <Link
        href={isAuthenticated ? '/demands/new' : '/auth/login'}
        className="flex items-center gap-3 bg-gradient-to-r from-brand-orange to-orange-500 rounded-2xl px-5 py-4 group transition-all hover:shadow-lg"
      >
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Gavel className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm">Can&apos;t find what you need?</p>
          <p className="text-white/70 text-xs">Post a demand and let sellers come to you!</p>
        </div>
        <div className="flex items-center gap-1 text-white font-bold text-xs flex-shrink-0 bg-white/20 px-3 py-2 rounded-xl group-hover:bg-white/30 transition-colors">
          Post <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </Link>
    </div>
  );
}
