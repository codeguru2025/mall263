'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, ChevronRight, Inbox } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  OPEN:      'Open',
  QUOTED:    'Quoted',
  ACCEPTED:  'Accepted',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  OPEN:      'bg-blue-50 text-blue-700',
  QUOTED:    'bg-amber-50 text-amber-700',
  ACCEPTED:  'bg-green-50 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-600',
};

function RequestCard({ req }: { req: any }) {
  const listing = req.listing;
  const quote   = req.quotes?.[0];
  return (
    <Link
      href={`/services/requests/${req.id}`}
      className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-start gap-3 hover:border-brand-blue/30 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Briefcase className="w-5 h-5 text-brand-blue" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 justify-between mb-1">
          <p className="font-black text-navy-700 text-sm truncate">{listing?.title ?? 'Service'}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[req.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[req.status] ?? req.status}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">
          {listing?.provider ? `${listing.provider.firstName} ${listing.provider.lastName}` : ''}
          {listing?.stall ? ` · ${listing.stall.name}` : ''}
        </p>
        {quote && (
          <p className="text-xs text-brand-green font-bold mt-1">
            Quote: {formatCurrency(Number(quote.amount))}
          </p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
    </Link>
  );
}

export default function MyServiceRequestsPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading     = useAuthStore((s) => s.isLoading);
  const user            = useAuthStore((s) => s.user);
  const [tab, setTab]   = useState<'mine' | 'incoming'>('mine');

  const isProvider = user?.role === 'STALL_OWNER' || user?.role === 'ATTENDANT';

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login?next=/services/requests');
  }, [authLoading, isAuthenticated, router]);

  const { data: mine = [], isLoading: loadingMine } = useQuery<any[]>({
    queryKey: ['service-requests-mine'],
    queryFn: () => api.get('/api/v1/services/requests/mine').then((r) => r.data),
    enabled: isAuthenticated && tab === 'mine',
  });

  const { data: incoming = [], isLoading: loadingIncoming } = useQuery<any[]>({
    queryKey: ['service-requests-incoming'],
    queryFn: () => api.get('/api/v1/services/requests/incoming').then((r) => r.data),
    enabled: isAuthenticated && isProvider && tab === 'incoming',
  });

  const list    = tab === 'mine' ? mine : incoming;
  const loading = tab === 'mine' ? loadingMine : loadingIncoming;

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <header className="bg-white border-b border-gray-100 safe-area-top sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/services" className="p-2 rounded-xl hover:bg-gray-50 text-navy-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-black text-navy-700 text-sm">Service Requests</span>
        </div>
        {isProvider && (
          <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
            <button
              onClick={() => setTab('mine')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${tab === 'mine' ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              My Requests
            </button>
            <button
              onClick={() => setTab('incoming')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${tab === 'incoming' ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Incoming
            </button>
          </div>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {loading ? (
          <div className="text-center text-sm text-gray-400 font-semibold py-12">Loading…</div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Inbox className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-bold text-gray-400">No requests yet</p>
          </div>
        ) : (
          list.map((req: any) => <RequestCard key={req.id} req={req} />)
        )}
      </div>
    </div>
  );
}
