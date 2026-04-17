'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import {
  ArrowLeft, Plus, Trash2, Loader2, Tag, Users,
  ToggleLeft, ToggleRight, X, Percent, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';

type PromoType = 'REFERRAL' | 'COUPON' | 'DISCOUNT';

interface Promotion {
  id: string;
  code: string;
  type: PromoType;
  discountPct: string | null;
  discountAmt: string | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  description: string | null;
}

const BLANK = {
  code: '',
  type: 'COUPON' as PromoType,
  discountType: 'pct' as 'pct' | 'amt',
  discountValue: '',
  maxUses: '',
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: '',
  description: '',
};

const TYPE_LABELS: Record<PromoType, string> = {
  REFERRAL: 'Referral',
  COUPON: 'Coupon',
  DISCOUNT: 'Discount',
};

const TYPE_COLORS: Record<PromoType, string> = {
  REFERRAL: 'bg-purple-50 text-purple-700',
  COUPON: 'bg-blue-50 text-blue-700',
  DISCOUNT: 'bg-orange-50 text-brand-orange',
};

export default function PromotionsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS'].includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  const { data: promos = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ['admin-promotions'],
    queryFn: () => api.get('/api/v1/admin/promotions').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/api/v1/admin/promotions', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success('Promotion created');
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      setShowForm(false);
      setForm(BLANK);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Create failed'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/admin/promotions/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-promotions'] }),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/promotions/${id}`),
    onSuccess: () => {
      toast.success('Promotion deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const handleSubmit = () => {
    if (!form.code.trim()) { toast.error('Code is required'); return; }
    if (!form.discountValue) { toast.error('Discount value is required'); return; }
    createMutation.mutate({
      code: form.code.trim().toUpperCase(),
      type: form.type,
      discountPct: form.discountType === 'pct' ? parseFloat(form.discountValue) : undefined,
      discountAmt: form.discountType === 'amt' ? parseFloat(form.discountValue) : undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      validFrom: form.validFrom,
      validUntil: form.validUntil || undefined,
      description: form.description.trim() || undefined,
    });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex-shrink-0"><Logo size={28} /></Link>
            <div>
              <h1 className="text-base font-black text-navy-700">Promotions & Referrals</h1>
              <p className="text-xs text-gray-500">Create discount codes and referral programmes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-navy-700 text-white text-xs font-bold rounded-xl hover:bg-navy-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Code
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : promos.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="font-bold">No promotions yet</p>
            <p className="text-sm mt-1">Create a referral code or discount coupon.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 font-bold uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Code</th>
                  <th className="text-left px-3 py-3 hidden sm:table-cell">Type</th>
                  <th className="text-left px-3 py-3">Discount</th>
                  <th className="text-left px-3 py-3 hidden md:table-cell">Uses</th>
                  <th className="text-left px-3 py-3 hidden lg:table-cell">Valid Until</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {promos.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black font-mono text-navy-700">{promo.code}</span>
                        {!promo.isActive && (
                          <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-bold">Off</span>
                        )}
                      </div>
                      {promo.description && <p className="text-xs text-gray-400 mt-0.5">{promo.description}</p>}
                    </td>
                    <td className="px-3 py-4 hidden sm:table-cell">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${TYPE_COLORS[promo.type]}`}>
                        {TYPE_LABELS[promo.type]}
                      </span>
                    </td>
                    <td className="px-3 py-4 font-bold text-navy-700">
                      {promo.discountPct ? `${promo.discountPct}%` : promo.discountAmt ? `$${promo.discountAmt}` : '—'}
                    </td>
                    <td className="px-3 py-4 hidden md:table-cell text-gray-500">
                      {promo.usedCount}
                      {promo.maxUses ? ` / ${promo.maxUses}` : ' / ∞'}
                    </td>
                    <td className="px-3 py-4 hidden lg:table-cell text-gray-500 text-xs">
                      {promo.validUntil ? new Date(promo.validUntil).toLocaleDateString() : 'No expiry'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => toggleMutation.mutate({ id: promo.id, isActive: !promo.isActive })}
                          title={promo.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {promo.isActive
                            ? <ToggleRight className="w-5 h-5 text-brand-green" />
                            : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete code "${promo.code}"?`)) deleteMutation.mutate(promo.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-navy-700">New Promotion</h2>
              <button onClick={() => { setShowForm(false); setForm(BLANK); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Code *</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="WELCOME20"
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm font-mono text-navy-700 font-bold focus:border-brand-green outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PromoType }))}
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
                  >
                    <option value="COUPON">Coupon</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="DISCOUNT">Discount</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">Discount</label>
                <div className="flex gap-2">
                  <div className="flex border-2 border-gray-100 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setForm((f) => ({ ...f, discountType: 'pct' }))}
                      className={`px-3 py-2 text-xs font-bold flex items-center gap-1 transition-colors ${form.discountType === 'pct' ? 'bg-navy-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <Percent className="w-3.5 h-3.5" /> %
                    </button>
                    <button
                      onClick={() => setForm((f) => ({ ...f, discountType: 'amt' }))}
                      className={`px-3 py-2 text-xs font-bold flex items-center gap-1 transition-colors ${form.discountType === 'amt' ? 'bg-navy-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <DollarSign className="w-3.5 h-3.5" /> $
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step={form.discountType === 'pct' ? '1' : '0.01'}
                    value={form.discountValue}
                    onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                    placeholder={form.discountType === 'pct' ? '20' : '1.00'}
                    className="flex-1 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Valid From</label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 focus:border-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Valid Until (optional)</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 focus:border-brand-green outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block flex items-center gap-1">
                    <Users className="w-3 h-3" /> Max Uses (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxUses}
                    onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                    placeholder="∞ unlimited"
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 focus:border-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Description</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Welcome discount"
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 focus:border-brand-green outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setShowForm(false); setForm(BLANK); }} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="flex-1 py-3 bg-navy-700 text-white font-black rounded-xl hover:bg-navy-800 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
