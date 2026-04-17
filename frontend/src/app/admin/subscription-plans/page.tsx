'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import {
  ArrowLeft, Plus, Pencil, Trash2, Loader2, CheckCircle2,
  Star, DollarSign, Clock, ToggleLeft, ToggleRight, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceUsd: string;
  trialDays: number;
  description: string | null;
  features: string[];
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

const BLANK_PLAN = {
  name: '',
  slug: '',
  priceUsd: '',
  trialDays: '7',
  description: '',
  features: [''],
  isActive: true,
  isDefault: false,
  sortOrder: '0',
};

export default function SubscriptionPlansPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_PLAN);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS'].includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['admin-subscription-plans'],
    queryFn: () => api.get('/api/v1/admin/subscription-plans').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      editingId
        ? api.patch(`/api/v1/admin/subscription-plans/${editingId}`, payload).then((r) => r.data)
        : api.post('/api/v1/admin/subscription-plans', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success(editingId ? 'Plan updated' : 'Plan created');
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plans-public'] });
      closeForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Save failed'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      api.patch(`/api/v1/admin/subscription-plans/${id}`, { [field]: value }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plans-public'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/subscription-plans/${id}`),
    onSuccess: () => {
      toast.success('Plan deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-plans-public'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const openCreate = () => { setForm(BLANK_PLAN); setEditingId(null); setShowForm(true); };

  const openEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      slug: plan.slug,
      priceUsd: String(plan.priceUsd),
      trialDays: String(plan.trialDays),
      description: plan.description ?? '',
      features: plan.features.length ? [...plan.features] : [''],
      isActive: plan.isActive,
      isDefault: plan.isDefault,
      sortOrder: String(plan.sortOrder),
    });
    setEditingId(plan.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleFeatureChange = (i: number, val: string) => {
    const updated = [...form.features];
    updated[i] = val;
    setForm((f) => ({ ...f, features: updated }));
  };

  const addFeature = () => setForm((f) => ({ ...f, features: [...f.features, ''] }));
  const removeFeature = (i: number) =>
    setForm((f) => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }));

  const handleSubmit = () => {
    if (!form.name.trim() || !form.priceUsd) { toast.error('Name and price are required'); return; }
    saveMutation.mutate({
      name: form.name.trim(),
      slug: form.slug.trim() || form.name.toLowerCase().replace(/\s+/g, '-'),
      priceUsd: parseFloat(form.priceUsd),
      trialDays: parseInt(form.trialDays) || 7,
      description: form.description.trim() || null,
      features: form.features.filter(Boolean),
      isActive: form.isActive,
      isDefault: form.isDefault,
      sortOrder: parseInt(form.sortOrder) || 0,
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
              <h1 className="text-base font-black text-navy-700">Subscription Plans</h1>
              <p className="text-xs text-gray-500">Manage plans, pricing, and included features</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 bg-navy-700 text-white text-xs font-bold rounded-xl hover:bg-navy-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Plan
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="font-bold">No plans yet</p>
            <p className="text-sm mt-1">Create your first subscription plan.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.id} className={`bg-white rounded-2xl border-2 p-5 transition-all ${plan.isDefault ? 'border-brand-green' : 'border-gray-100'}`}>
                {plan.isDefault && (
                  <div className="flex items-center gap-1 text-xs text-brand-green font-bold mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Default plan
                  </div>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-black text-navy-700">{plan.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{plan.slug}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-navy-700">${Number(plan.priceUsd).toFixed(2)}</span>
                    <p className="text-xs text-gray-400">/month</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{plan.trialDays}-day trial</span>
                  <span className={`px-2 py-0.5 rounded-full font-bold ${plan.isActive ? 'bg-green-50 text-brand-green' : 'bg-gray-100 text-gray-400'}`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {plan.description && (
                  <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
                )}

                <ul className="space-y-1.5 mb-4">
                  {(plan.features || []).map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-navy-700">
                      <Star className="w-3 h-3 text-brand-orange flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => toggleMutation.mutate({ id: plan.id, field: 'isActive', value: !plan.isActive })}
                    title={plan.isActive ? 'Deactivate' : 'Activate'}
                    className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {plan.isActive
                      ? <ToggleRight className="w-5 h-5 text-brand-green" />
                      : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                  {!plan.isDefault && (
                    <button
                      onClick={() => toggleMutation.mutate({ id: plan.id, field: 'isDefault', value: true })}
                      className="text-xs text-gray-400 hover:text-navy-700 font-semibold px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Set default
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => openEdit(plan)}
                      className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors text-gray-400 hover:text-navy-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete plan "${plan.name}"?`)) deleteMutation.mutate(plan.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-navy-700">{editingId ? 'Edit Plan' : 'New Plan'}</h2>
              <button onClick={closeForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Plan Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Premium"
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    placeholder="e.g. premium"
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-mono focus:border-brand-green outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Price (USD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.priceUsd}
                      onChange={(e) => setForm((f) => ({ ...f, priceUsd: e.target.value }))}
                      placeholder="5.00"
                      className="w-full border-2 border-gray-100 rounded-xl pl-7 pr-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Trial Days</label>
                  <input
                    type="number"
                    min="0"
                    value={form.trialDays}
                    onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
                    placeholder="7"
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown to users"
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 focus:border-brand-green outline-none"
                />
              </div>

              {/* Features */}
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">Included Features</label>
                <div className="space-y-2">
                  {form.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" />
                      <input
                        value={feat}
                        onChange={(e) => handleFeatureChange(i, e.target.value)}
                        placeholder="e.g. Full POS & sales management"
                        className="flex-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm text-navy-700 focus:border-brand-green outline-none"
                      />
                      {form.features.length > 1 && (
                        <button onClick={() => removeFeature(i)} className="text-gray-300 hover:text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addFeature}
                  className="mt-2 flex items-center gap-1 text-xs text-brand-green font-bold hover:text-green-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Add feature
                </button>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-semibold text-navy-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-brand-green"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-navy-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                    className="w-4 h-4 accent-brand-green"
                  />
                  Default plan
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 pb-6 pt-4 border-t border-gray-100 flex gap-3">
              <button onClick={closeForm} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                className="flex-1 py-3 bg-navy-700 text-white font-black rounded-xl hover:bg-navy-800 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
