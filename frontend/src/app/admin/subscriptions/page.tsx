'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import {
  ArrowLeft, Search, Loader2, Gift, CheckCircle2,
  AlertCircle, Clock, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SubStatus = 'TRIAL' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED';

interface Subscription {
  id: string;
  status: SubStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  ecocashNumber: string | null;
  failedAttempts: number;
  user: { id: string; firstName: string; lastName: string; phone: string; role: string };
  payments: { status: string; amount: string; initiatedAt: string }[];
}

interface ListResponse {
  data: Subscription[];
  total: number;
  page: number;
  totalPages: number;
  summary: { trial: number; active: number; grace: number; expired: number };
}

const STATUS_STYLES: Record<SubStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  TRIAL:     { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: Gift,         label: 'Trial' },
  ACTIVE:    { bg: 'bg-green-50',  text: 'text-brand-green', icon: CheckCircle2, label: 'Active' },
  GRACE:     { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: Clock,        label: 'Grace' },
  EXPIRED:   { bg: 'bg-red-50',    text: 'text-red-600',    icon: AlertCircle,  label: 'Expired' },
  CANCELLED: { bg: 'bg-gray-100',  text: 'text-gray-500',   icon: XCircle,      label: 'Cancelled' },
};

export default function AdminSubscriptionsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<SubStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'].includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['admin-subscriptions', statusFilter, search, page],
    queryFn: () =>
      api.get('/api/v1/admin/subscriptions', {
        params: { status: statusFilter || undefined, search: search || undefined, page, limit: 25 },
      }).then((r) => r.data),
    enabled: isAuthenticated,
  });

  const extendMutation = useMutation({
    mutationFn: ({ userId, days }: { userId: string; days: number }) =>
      api.patch(`/api/v1/admin/subscriptions/${userId}/extend-trial`, { days }).then((r) => r.data),
    onSuccess: (_, { userId }) => {
      toast.success('Trial extended');
      setExtendDays((prev) => ({ ...prev, [userId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const grantMutation = useMutation({
    mutationFn: (userId: string) =>
      api.patch(`/api/v1/admin/subscriptions/${userId}/grant-month`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Free month granted');
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const summary = data?.summary;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex-shrink-0"><Logo size={28} /></Link>
            <div>
              <h1 className="text-base font-black text-navy-700">Subscriptions</h1>
              <p className="text-xs text-gray-500">Manage seller subscription status and trials</p>
            </div>
          </div>
          <Link href="/admin" className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 pb-24">

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {(
              [
                { label: 'On Trial',  value: summary.trial,   color: 'text-blue-700',   bg: 'bg-blue-50' },
                { label: 'Active',    value: summary.active,  color: 'text-brand-green', bg: 'bg-green-50' },
                { label: 'Grace',     value: summary.grace,   color: 'text-amber-700',  bg: 'bg-amber-50' },
                { label: 'Expired',   value: summary.expired, color: 'text-red-600',    bg: 'bg-red-50' },
              ] as const
            ).map((card) => (
              <button
                key={card.label}
                onClick={() => {
                  const map: Record<string, SubStatus | ''> = {
                    'On Trial': 'TRIAL', Active: 'ACTIVE', Grace: 'GRACE', Expired: 'EXPIRED',
                  };
                  setStatusFilter((prev) => prev === map[card.label] ? '' : map[card.label]!);
                  setPage(1);
                }}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${statusFilter === { 'On Trial': 'TRIAL', Active: 'ACTIVE', Grace: 'GRACE', Expired: 'EXPIRED' }[card.label] ? 'border-navy-700' : 'border-gray-100 bg-white'}`}
              >
                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or phone…"
              className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-100 rounded-xl text-sm text-navy-700 focus:border-brand-green outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as SubStatus | ''); setPage(1); }}
            className="border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
          >
            <option value="">All statuses</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="GRACE">Grace</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {(!data?.data.length) ? (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                <p className="font-semibold">No subscriptions match</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wide">
                        <th className="text-left px-5 py-3">User</th>
                        <th className="text-left px-3 py-3">Status</th>
                        <th className="text-left px-3 py-3 hidden md:table-cell">Trial / Period ends</th>
                        <th className="text-left px-3 py-3 hidden lg:table-cell">EcoCash</th>
                        <th className="text-right px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.data.map((sub) => {
                        const st = STATUS_STYLES[sub.status] || STATUS_STYLES.CANCELLED;
                        const Icon = st.icon;
                        const dateLabel =
                          sub.status === 'TRIAL'
                            ? `Trial ends ${new Date(sub.trialEndsAt).toLocaleDateString()}`
                            : sub.currentPeriodEnd
                            ? `Period ends ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                            : '—';
                        return (
                          <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-bold text-navy-700">
                                {sub.user.firstName} {sub.user.lastName}
                              </div>
                              <div className="text-xs text-gray-400">{sub.user.phone}</div>
                            </td>
                            <td className="px-3 py-4">
                              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${st.bg} ${st.text}`}>
                                <Icon className="w-3 h-3" /> {st.label}
                              </span>
                              {sub.failedAttempts > 0 && (
                                <div className="text-xs text-red-400 mt-0.5">{sub.failedAttempts} failed payments</div>
                              )}
                            </td>
                            <td className="px-3 py-4 hidden md:table-cell text-xs text-gray-500">{dateLabel}</td>
                            <td className="px-3 py-4 hidden lg:table-cell text-xs text-gray-400 font-mono">
                              {sub.ecocashNumber ?? '—'}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 justify-end flex-wrap">
                                {/* Extend trial */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    max="90"
                                    value={extendDays[sub.user.id] ?? ''}
                                    onChange={(e) => setExtendDays((prev) => ({ ...prev, [sub.user.id]: e.target.value }))}
                                    placeholder="days"
                                    className="w-16 border-2 border-gray-100 rounded-lg px-2 py-1.5 text-xs text-navy-700 font-semibold focus:border-brand-green outline-none"
                                  />
                                  <button
                                    onClick={() => {
                                      const d = parseInt(extendDays[sub.user.id] ?? '7');
                                      if (d > 0) extendMutation.mutate({ userId: sub.user.id, days: d });
                                    }}
                                    disabled={extendMutation.isPending}
                                    className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60"
                                  >
                                    +Trial
                                  </button>
                                </div>
                                {/* Grant month */}
                                <button
                                  onClick={() => {
                                    if (confirm(`Grant 1 free month to ${sub.user.firstName}?`)) {
                                      grantMutation.mutate(sub.user.id);
                                    }
                                  }}
                                  disabled={grantMutation.isPending}
                                  className="text-xs bg-green-50 text-brand-green font-bold px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-60"
                                >
                                  Free month
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      {data.total} total · page {data.page} of {data.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-xl border-2 border-gray-100 text-gray-400 hover:text-navy-700 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                        disabled={page === data.totalPages}
                        className="p-2 rounded-xl border-2 border-gray-100 text-gray-400 hover:text-navy-700 disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
