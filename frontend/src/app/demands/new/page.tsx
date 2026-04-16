'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Gavel, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

function NewDemandForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const linkedProductId = searchParams.get('productId') || '';
  const linkedStallId = searchParams.get('stallId') || '';
  const linkedCategoryId = searchParams.get('categoryId') || '';
  const linkedBrand = searchParams.get('brand') || '';
  const prefillTitle = searchParams.get('title') || '';
  const prefillMin = searchParams.get('minPrice') || '';
  const prefillMax = searchParams.get('maxPrice') || '';
  const isProductDemand = !!linkedProductId;

  const [form, setForm] = useState({
    title: prefillTitle,
    description: linkedBrand ? `Brand: ${linkedBrand}` : '',
    minBudget: prefillMin,
    maxBudget: prefillMax,
    urgency: 'MEDIUM',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/api/v1/demands', {
        title: form.title,
        description: form.description,
        minBudget: parseFloat(form.minBudget),
        maxBudget: parseFloat(form.maxBudget),
        urgency: form.urgency,
        ...(linkedProductId && { productId: linkedProductId }),
        ...(linkedStallId && { stallId: linkedStallId }),
        ...(linkedCategoryId && { categoryId: linkedCategoryId }),
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success(isProductDemand
        ? 'Demand posted! The seller has been notified.'
        : 'Demand posted! Sellers will start responding shortly.');
      router.push('/demands');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to post demand'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.minBudget || !form.maxBudget) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (parseFloat(form.minBudget) <= 0 || parseFloat(form.maxBudget) <= 0) {
      toast.error('Budget must be greater than $0');
      return;
    }
    if (parseFloat(form.minBudget) > parseFloat(form.maxBudget)) {
      toast.error('Min budget cannot exceed max budget');
      return;
    }
    mutation.mutate();
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={isProductDemand ? `/marketplace/${linkedProductId}` : '/demands'} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">
              {isProductDemand ? 'Request This Product' : 'Post a Demand'}
            </h1>
            <p className="text-xs text-gray-500">
              {isProductDemand ? 'The seller will respond with an offer' : 'Tell sellers what you need'}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 pb-28 sm:pb-8">
        {isProductDemand && (
          <div className="bg-blue-50 rounded-2xl border-2 border-blue-100 p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-5 h-5 text-brand-blue" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-navy-700 truncate">{prefillTitle || 'Selected product'}</p>
              <p className="text-xs text-gray-500">Your demand is linked to this product. The seller will be notified directly.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border-2 border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isProductDemand ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <Gavel className={`w-6 h-6 ${isProductDemand ? 'text-brand-blue' : 'text-brand-orange'}`} />
            </div>
            <div>
              <h2 className="font-black text-navy-700">{isProductDemand ? 'Confirm Your Request' : 'New Demand'}</h2>
              <p className="text-sm text-gray-500">Set your budget and submit — the seller will make you an offer</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">What do you need? <span className="text-brand-red">*</span></label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Nike Air Max 90 Size 42, Mazoe Orange Crush 2L"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Description / Notes</label>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Add more details — colour, condition, size, quantity..."
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Min Budget ($) <span className="text-brand-red">*</span></label>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={form.minBudget}
                  onChange={(e) => update('minBudget', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Max Budget ($) <span className="text-brand-red">*</span></label>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={form.maxBudget}
                  onChange={(e) => update('maxBudget', e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Urgency</label>
              <div className="grid grid-cols-3 gap-3">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => update('urgency', u)}
                    className={`py-2.5 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                      form.urgency === u
                        ? u === 'HIGH' ? 'border-brand-red bg-red-50 text-brand-red'
                          : u === 'MEDIUM' ? 'border-brand-orange bg-orange-50 text-brand-orange'
                          : 'border-brand-blue bg-blue-50 text-brand-blue'
                        : 'border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
            >
              <Gavel className="w-5 h-5" />
              {mutation.isPending ? 'Posting...' : isProductDemand ? 'Submit Request' : 'Post Demand'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function NewDemandPage() {
  return (
    <Suspense>
      <NewDemandForm />
    </Suspense>
  );
}
