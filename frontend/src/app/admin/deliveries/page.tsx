'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Truck, ChevronRight, Loader2, ShieldCheck, Banknote, Handshake } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useState, useEffect } from 'react';

const STATUS_COLORS: Record<string, string> = {
  BROADCAST: 'bg-gray-100 text-gray-600',
  ACCEPTED: 'bg-blue-100 text-brand-blue',
  PICKUP_CONFIRMED: 'bg-blue-100 text-brand-blue',
  IN_TRANSIT: 'bg-orange-100 text-brand-orange',
  DELIVERED: 'bg-green-100 text-brand-green',
  COMPLETED: 'bg-green-100 text-brand-green',
  CANCELLED: 'bg-red-100 text-brand-red',
  RETURNED: 'bg-red-100 text-brand-red',
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  SAFE_PAY: <ShieldCheck className="w-3.5 h-3.5" />,
  CASH_ON_DELIVERY: <Banknote className="w-3.5 h-3.5" />,
  DIRECT_DEAL: <Handshake className="w-3.5 h-3.5" />,
};

const STATUSES = ['', 'BROADCAST', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

export default function AdminDeliveriesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'].includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['admin-deliveries', filter],
    queryFn: () =>
      api.get('/api/v1/delivery/jobs', { params: { status: filter || undefined, limit: 100 } }).then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={28} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Delivery Jobs</h1>
            <p className="text-xs text-gray-400">All platform delivery jobs</p>
          </div>
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse inline-block" />
            Live · 30 s
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                filter === s ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-gray-100 bg-white text-gray-500'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold">No delivery jobs found</p>
          </div>
        ) : (
          jobs.map((job: any) => (
            <Link
              key={job.id}
              href={`/delivery/${job.id}`}
              className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-center gap-4 hover:border-brand-blue transition-colors block"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[job.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {job.status.replace(/_/g, ' ')}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                    {MODE_ICONS[job.mode]} {job.mode.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm font-bold text-navy-700 truncate">
                  {job.pickupZone} → {job.dropZone}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                  <span>Item: {formatCurrency(parseFloat(job.itemAmount ?? '0'))}</span>
                  <span>Fee: {formatCurrency(parseFloat(job.deliveryFee ?? '0'))}</span>
                  {job.driver && <span>Driver: {job.driver.user?.firstName}</span>}
                  {job.dispute && <span className="text-brand-red font-bold">⚠ Dispute</span>}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
