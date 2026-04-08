'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Gavel, Clock, ChevronRight, Zap, PlusCircle, MessageSquare } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function DemandsPage() {
  const [tab, setTab] = useState<'open' | 'my'>('open');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: demands, isLoading } = useQuery({
    queryKey: ['demands', tab],
    queryFn: () => api.get(tab === 'my' ? '/api/v1/demands/my' : '/api/v1/demands/open', { params: { limit: 20 } }).then((r) => r.data),
    enabled: tab === 'open' || isAuthenticated,
  });

  const statusConfig: Record<string, { badge: string; label: string }> = {
    OPEN: { badge: 'badge-live', label: 'LIVE' },
    MATCHED: { badge: 'badge-bid', label: 'MATCHED' },
    FULFILLED: { badge: 'badge-success', label: 'FULFILLED' },
    EXPIRED: { badge: 'badge-danger', label: 'EXPIRED' },
    CLOSED: { badge: 'bg-gray-100 text-gray-600 border border-gray-200', label: 'CLOSED' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex-shrink-0"><Logo size={30} /></Link>
            <div className="hidden sm:block">
              <h1 className="text-lg font-black text-navy-700">Demand Board</h1>
              <p className="text-xs text-gray-500">Live auction-style requests</p>
            </div>
          </div>
          <Link href="/demands/new" className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2">
            <PlusCircle className="w-4 h-4" /> Post Demand
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-5">
        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('open')} className={`py-2.5 px-5 rounded-xl text-sm font-bold transition-all ${tab === 'open' ? 'bg-navy-700 text-white shadow-md' : 'bg-white text-navy-600 border-2 border-gray-100 hover:border-gray-200'}`}>
            <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Live Demands</span>
          </button>
          <button onClick={() => setTab('my')} className={`py-2.5 px-5 rounded-xl text-sm font-bold transition-all ${tab === 'my' ? 'bg-navy-700 text-white shadow-md' : 'bg-white text-navy-600 border-2 border-gray-100 hover:border-gray-200'}`}>
            My Demands
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border border-gray-100">
                <div className="flex items-center gap-2 mb-3"><div className="bg-red-100 rounded-full h-6 w-14" /><div className="bg-gray-100 rounded-lg h-5 w-2/3" /></div>
                <div className="bg-gray-100 rounded-lg h-4 w-full mb-2" />
                <div className="bg-gray-100 rounded-lg h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {(demands?.data || demands || []).map((d: any) => {
              const sc = statusConfig[d.status] || statusConfig.CLOSED;
              return (
                <Link key={d.id} href={`/demands/${d.id}`} className="block bg-white rounded-2xl border-2 border-gray-100 hover:border-brand-orange hover:shadow-lg transition-all overflow-hidden group">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`badge text-[10px] ${sc.badge}`}>{sc.label}</span>
                          <h3 className="font-bold text-navy-700 group-hover:text-brand-orange transition-colors">{d.title}</h3>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{d.description}</p>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">Budget:</span>
                            <span className="text-sm font-black text-navy-700">{formatCurrency(parseFloat(d.minBudget || '0'))} - {formatCurrency(parseFloat(d.maxBudget || '0'))}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-bold text-brand-green">
                            <Gavel className="w-3.5 h-3.5" /> {d._count?.offers || d.offersCount || 0} offers
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5" /> {new Date(d.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-orange transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </div>
                  {d.status === 'OPEN' && (
                    <div className="bg-gradient-to-r from-orange-50 to-green-50 px-5 py-2.5 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Sellers can submit offers now</span>
                      <span className="text-xs font-bold text-brand-orange">View &amp; Bid →</span>
                    </div>
                  )}
                </Link>
              );
            })}
            {(demands?.data || demands || []).length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gavel className="w-10 h-10 text-brand-orange" />
                </div>
                <h3 className="text-xl font-black text-navy-700 mb-2">No demands yet</h3>
                <p className="text-gray-500 mb-6">Be the first to post what you need. Sellers will compete to offer you the best deal!</p>
                <Link href="/demands/new" className="btn-primary">Post Your First Demand</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
