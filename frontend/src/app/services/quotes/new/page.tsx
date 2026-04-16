'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

function SubmitQuoteForm() {
  const searchParams  = useSearchParams();
  const requestId     = searchParams.get('requestId') ?? '';
  const router        = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading     = useAuthStore((s) => s.isLoading);

  const [amount, setAmount]       = useState('');
  const [desc, setDesc]           = useState('');
  const [days, setDays]           = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const mutation = useMutation({
    mutationFn: (body: { amount: number; description?: string; estimatedDays?: number }) =>
      api.post(`/api/v1/services/requests/${requestId}/quote`, body).then((r) => r.data),
    onSuccess: () => {
      toast.success('Quote submitted!');
      router.push(`/services/requests/${requestId}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to submit quote'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amtNum  = parseFloat(amount);
    const daysNum = parseInt(days, 10);
    if (!Number.isFinite(amtNum) || amtNum <= 0) return toast.error('Enter a valid amount');
    mutation.mutate({
      amount:        amtNum,
      description:   desc.trim() || undefined,
      estimatedDays: Number.isFinite(daysNum) && daysNum > 0 ? daysNum : undefined,
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <header className="bg-white border-b border-gray-100 safe-area-top sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/services/requests/${requestId}`} className="p-2 rounded-xl hover:bg-gray-50 text-navy-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-black text-navy-700 text-sm">Submit Quote</span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <label className="block text-sm font-bold text-navy-700 mb-1.5">Amount (USD) *</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full rounded-2xl border-2 border-gray-100 px-4 py-3 text-sm text-navy-700 placeholder-gray-400 focus:outline-none focus:border-brand-blue"
            placeholder="e.g. 75.00"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-navy-700 mb-1.5">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border-2 border-gray-100 px-4 py-3 text-sm text-navy-700 placeholder-gray-400 focus:outline-none focus:border-brand-blue resize-none"
            placeholder="What's included in this quote…"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-navy-700 mb-1.5">
            Estimated days <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-full rounded-2xl border-2 border-gray-100 px-4 py-3 text-sm text-navy-700 placeholder-gray-400 focus:outline-none focus:border-brand-blue"
            placeholder="e.g. 3"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-brand-blue text-white font-black text-sm py-4 shadow-md disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {mutation.isPending ? 'Submitting…' : <><Send className="w-4 h-4" /> Submit Quote</>}
        </button>
      </form>
    </div>
  );
}

export default function SubmitQuotePage() {
  return (
    <Suspense>
      <SubmitQuoteForm />
    </Suspense>
  );
}
