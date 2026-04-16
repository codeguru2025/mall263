'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, Send } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ServiceRequestPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [notes, setNotes] = useState('');
  const [budgetHint, setBudgetHint] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push(`/auth/login?next=/services/request/${listingId}`);
  }, [authLoading, isAuthenticated, router, listingId]);

  const { data: listing } = useQuery({
    queryKey: ['service', listingId],
    queryFn: () => api.get(`/api/v1/services/${listingId}`).then((r) => r.data),
    enabled: !!listingId && isAuthenticated,
  });

  const mutation = useMutation({
    mutationFn: (body: { notes?: string; budgetHint?: number }) =>
      api.post(`/api/v1/services/${listingId}/requests`, body).then((r) => r.data),
    onSuccess: () => {
      toast.success('Quote request sent!');
      router.push('/services/requests');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to send request');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const budget = parseFloat(budgetHint);
    mutation.mutate({
      notes: notes.trim() || undefined,
      budgetHint: Number.isFinite(budget) && budget > 0 ? budget : undefined,
    });
  }

  if (authLoading || !isAuthenticated) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <header className="bg-white border-b border-gray-100 safe-area-top sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/services/${listingId}`} className="p-2 rounded-xl hover:bg-gray-50 text-navy-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-black text-navy-700 text-sm">Request a Quote</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {listing && (
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <p className="font-black text-navy-700 text-sm">{listing.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {listing.provider?.firstName} {listing.provider?.lastName}
                {listing.stall ? ` · ${listing.stall.name}` : ''}
              </p>
              {listing.priceFrom != null && Number(listing.priceFrom) > 0 && (
                <p className="text-xs text-brand-green font-bold mt-1">
                  From {formatCurrency(Number(listing.priceFrom))}
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-1.5">
              Describe what you need <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border-2 border-gray-100 px-4 py-3 text-sm text-navy-700 placeholder-gray-400 focus:outline-none focus:border-brand-blue resize-none"
              placeholder="Tell the provider what you need, any special requirements, timeline, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-navy-700 mb-1.5">
              Your budget hint <span className="text-gray-400 font-normal">(optional, USD)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budgetHint}
              onChange={(e) => setBudgetHint(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-100 px-4 py-3 text-sm text-navy-700 placeholder-gray-400 focus:outline-none focus:border-brand-blue"
              placeholder="e.g. 50"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-brand-blue text-white font-black text-sm py-4 shadow-md disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {mutation.isPending ? (
              'Sending…'
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Request
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
