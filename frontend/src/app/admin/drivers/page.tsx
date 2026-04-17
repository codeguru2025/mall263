'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Truck, ShieldCheck, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

const TIER_COLORS: Record<string, string> = {
  ONBOARDING: 'bg-gray-100 text-gray-600',
  TRUSTED: 'bg-blue-100 text-brand-blue',
  ELITE: 'bg-yellow-100 text-yellow-700',
};

const TIERS = ['ONBOARDING', 'TRUSTED', 'ELITE'];

export default function AdminDriversPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS'].includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: () => api.get('/api/v1/drivers').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const approveKyc = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/drivers/${id}/kyc-approve`).then((r) => r.data),
    onSuccess: () => { toast.success('KYC approved'); qc.invalidateQueries({ queryKey: ['admin-drivers'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Failed'),
  });

  const setTier = useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: string }) =>
      api.patch(`/api/v1/drivers/${id}/tier`, { tier }).then((r) => r.data),
    onSuccess: () => { toast.success('Tier updated'); qc.invalidateQueries({ queryKey: ['admin-drivers'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Failed'),
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
            <h1 className="text-lg font-black text-navy-700">Drivers</h1>
            <p className="text-xs text-gray-400">KYC verification &amp; tier management</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
        ) : drivers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold">No drivers registered yet</p>
          </div>
        ) : (
          drivers.map((d: any) => (
            <div key={d.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-black text-navy-700">{d.user?.firstName} {d.user?.lastName}</p>
                  <p className="text-xs text-gray-400">{d.user?.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${TIER_COLORS[d.tier] ?? 'bg-gray-100 text-gray-500'}`}>
                    {d.tier}
                  </span>
                  {d.isActive
                    ? <span className="text-xs font-bold bg-green-100 text-brand-green px-2 py-0.5 rounded-full">Active</span>
                    : <span className="text-xs font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Inactive</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div className="bg-gray-50 rounded-xl p-2">
                  <div className="text-xs text-gray-400">Jobs</div>
                  <div className="font-black text-navy-700">{d.completedJobs}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <div className="text-xs text-gray-400">Earned</div>
                  <div className="font-black text-navy-700">{formatCurrency(parseFloat(d.totalEarnings ?? '0'))}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-2">
                  <div className="text-xs text-gray-400">Rating</div>
                  <div className="font-black text-navy-700">{parseFloat(d.rating ?? '50').toFixed(0)}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {!d.kycVerified && (
                  <button
                    onClick={() => approveKyc.mutate(d.id)}
                    disabled={approveKyc.isPending}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-brand-green text-white hover:bg-green-600 transition-colors disabled:opacity-60"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Approve KYC
                  </button>
                )}
                {d.kycVerified && (
                  <span className="flex items-center gap-1 text-xs font-bold text-brand-green">
                    <ShieldCheck className="w-3.5 h-3.5" /> KYC Verified
                  </span>
                )}
                {/* Tier up/down */}
                {TIERS.indexOf(d.tier) > 0 && (
                  <button
                    onClick={() => setTier.mutate({ id: d.id, tier: TIERS[TIERS.indexOf(d.tier) - 1] })}
                    disabled={setTier.isPending}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" /> Demote
                  </button>
                )}
                {TIERS.indexOf(d.tier) < TIERS.length - 1 && (
                  <button
                    onClick={() => setTier.mutate({ id: d.id, tier: TIERS[TIERS.indexOf(d.tier) + 1] })}
                    disabled={setTier.isPending}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl border border-brand-blue text-brand-blue hover:bg-blue-50 transition-colors"
                  >
                    <ChevronUp className="w-3.5 h-3.5" /> Promote
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
