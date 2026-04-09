'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import Link from 'next/link';
import { ArrowLeft, Receipt, Search, Filter, ChevronRight, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  ECOCASH: 'EcoCash',
  ONEMONEY: 'OneMoney',
  TELECASH: 'Telecash',
  CARD: 'Card',
  WALLET: 'Wallet',
};

export default function SalesHistoryPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all'>('today');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
    if (user && !['STALL_OWNER', 'ATTENDANT'].includes(user.role)) { router.push('/dashboard'); return; }
  }, [authLoading, isAuthenticated, user, router]);

  const { data: merchant } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data).catch(() => null),
    enabled: isAuthenticated,
  });

  const { data: stalls } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: !!merchant?.id,
  });

  const stallId = stalls?.[0]?.id;

  const getDateRange = () => {
    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (dateFilter === '7d') {
      const start = new Date(now); start.setDate(start.getDate() - 7);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (dateFilter === '30d') {
      const start = new Date(now); start.setDate(start.getDate() - 30);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    return {};
  };

  const { data: salesRes, isLoading } = useQuery({
    queryKey: ['sales', stallId, dateFilter, page],
    queryFn: () => api.get(`/api/v1/pos/sales/stall/${stallId}`, {
      params: { ...getDateRange(), page, limit: 20 },
    }).then((r) => r.data),
    enabled: !!stallId,
  });

  const sales: any[] = salesRes?.data || [];
  const total = salesRes?.total || 0;
  const filtered = search
    ? sales.filter((s) => s.receiptNumber?.toLowerCase().includes(search.toLowerCase()))
    : sales;

  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.totalAmount), 0);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-navy-700" />
            </Link>
            <Logo size={30} />
            <div className="hidden sm:block">
              <h1 className="text-lg font-black text-navy-700">Sales History</h1>
              <p className="text-xs text-gray-500">{total} transactions</p>
            </div>
          </div>
          <Link href="/seller/reports" className="text-sm font-bold text-brand-blue hover:underline">
            View Reports
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 pb-28 sm:pb-8">
        {/* Date filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(['today', '7d', '30d', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setDateFilter(f); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                dateFilter === f ? 'bg-navy-700 text-white' : 'bg-white text-navy-600 border-2 border-gray-100'
              }`}
            >
              {f === 'today' ? 'Today' : f === '7d' ? 'Last 7 Days' : f === '30d' ? 'Last 30 Days' : 'All Time'}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        {sales.length > 0 && (
          <div className="bg-navy-700 rounded-2xl px-5 py-4 mb-4 flex items-center justify-between text-white">
            <div>
              <p className="text-white/60 text-xs">Total Revenue</p>
              <p className="text-2xl font-black">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="text-right">
              <p className="text-white/60 text-xs">Transactions</p>
              <p className="text-2xl font-black">{total}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-green mb-4">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by receipt number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-3 bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Sales list */}
        {!stallId || isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100 h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No sales found</p>
            <p className="text-gray-400 text-sm mt-1">Sales will appear here after you process them in POS</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((sale: any) => (
              <Link
                key={sale.id}
                href={`/receipts/${sale.id}`}
                className="bg-white rounded-2xl border-2 border-gray-100 hover:border-brand-green transition-all flex items-center gap-4 px-4 py-3"
              >
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5 text-brand-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-navy-700 text-sm">{sale.receiptNumber}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    {' · '}
                    {new Date(sale.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(sale.items || []).length} item{(sale.items || []).length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-navy-700">{formatCurrency(parseFloat(sale.totalAmount))}</p>
                  {sale.status === 'FULLY_REFUNDED' && (
                    <span className="text-xs text-brand-red font-bold flex items-center gap-1 justify-end">
                      <RotateCcw className="w-3 h-3" /> Refunded
                    </span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-center mt-6 gap-3">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40">
              Previous
            </button>
            <span className="py-2.5 px-4 text-sm font-bold text-navy-700 bg-white rounded-xl border-2 border-gray-100">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total} className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
