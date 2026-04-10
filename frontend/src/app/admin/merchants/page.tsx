'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Store, ArrowLeft, Search, CheckCircle, Ban, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import toast from 'react-hot-toast';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'];

const statusConfig: Record<string, { badge: string; label: string }> = {
  PENDING:   { badge: 'bg-orange-50 text-brand-orange border border-orange-200', label: 'Pending' },
  VERIFIED:  { badge: 'bg-green-50 text-brand-green border border-green-200',   label: 'Verified' },
  SUSPENDED: { badge: 'bg-red-50 text-brand-red border border-red-200',         label: 'Suspended' },
  DEACTIVATED: { badge: 'bg-gray-100 text-gray-500 border border-gray-200',     label: 'Deactivated' },
};

export default function AdminMerchantsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeMerchantId, setActiveMerchantId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const isAdmin = isAuthenticated && user && ADMIN_ROLES.includes(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.push('/dashboard');
  }, [authLoading, isAuthenticated, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-merchants', search, page],
    queryFn: () =>
      api.get('/api/v1/merchants', { params: { search: search || undefined, page, limit: 20 } }).then((r) => r.data),
    enabled: !!isAdmin,
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/api/v1/merchants/${id}/${action}`).then((r) => r.data),
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = { verify: 'verified', suspend: 'suspended', activate: 'activated' };
      toast.success(`Merchant ${labels[vars.action] ?? vars.action}`);
      queryClient.invalidateQueries({ queryKey: ['admin-merchants'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Action failed'),
    onSettled: () => setActiveMerchantId(null),
  });

  if (authLoading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-600" />
          </Link>
          <Logo size={28} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Manage Merchants</h1>
            <p className="text-xs text-gray-500">{data?.total ?? '—'} total merchants</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="bg-white rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-blue mb-5 transition-all">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full py-3 bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-gray-50 animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full" />
                <div className="flex-1">
                  <div className="bg-gray-100 h-4 rounded w-1/3 mb-2" />
                  <div className="bg-gray-100 h-3 rounded w-1/4" />
                </div>
              </div>
            ))
          ) : (data?.data || []).length === 0 ? (
            <div className="text-center py-16">
              <Store className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold">No merchants found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(data?.data || []).map((merchant: any) => {
                const sc = statusConfig[merchant.status] ?? statusConfig.PENDING;
                const busy = actionMutation.isPending && activeMerchantId === merchant.id;
                return (
                  <div key={merchant.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                    <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Store className="w-5 h-5 text-brand-green" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-navy-700 truncate">
                        {merchant.businessName || `${merchant.user?.firstName ?? ''} ${merchant.user?.lastName ?? ''}`.trim()}
                      </div>
                      <div className="text-xs text-gray-500">{merchant.user?.phone}</div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${sc.badge}`}>{sc.label}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {merchant.status === 'PENDING' && (
                        <button
                          onClick={() => { setActiveMerchantId(merchant.id); actionMutation.mutate({ id: merchant.id, action: 'verify' }); }}
                          disabled={busy}
                          className="p-2 rounded-xl hover:bg-green-50 text-brand-green transition-colors disabled:opacity-50"
                          title="Verify merchant"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      )}
                      {merchant.status === 'VERIFIED' && (
                        <button
                          onClick={() => { setActiveMerchantId(merchant.id); actionMutation.mutate({ id: merchant.id, action: 'suspend' }); }}
                          disabled={busy}
                          className="p-2 rounded-xl hover:bg-red-50 text-brand-red transition-colors disabled:opacity-50"
                          title="Suspend merchant"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {(merchant.status === 'SUSPENDED' || merchant.status === 'DEACTIVATED') && (
                        <button
                          onClick={() => { setActiveMerchantId(merchant.id); actionMutation.mutate({ id: merchant.id, action: 'activate' }); }}
                          disabled={busy}
                          className="p-2 rounded-xl hover:bg-green-50 text-brand-green transition-colors disabled:opacity-50"
                          title="Reinstate merchant"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {(data?.total || 0) > 20 && (
          <div className="flex justify-center mt-6 gap-3">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40">Previous</button>
            <span className="py-2.5 px-4 text-sm font-bold text-navy-700 bg-white rounded-xl border-2 border-gray-100">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= (data?.total || 0)} className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
