'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Gavel, Clock, CheckCircle2, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function DemandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({ message: '', totalPrice: '', stallId: '' });

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, router]);

  const { data: demand, isLoading, isError } = useQuery({
    queryKey: ['demand', id],
    queryFn: () => api.get(`/api/v1/demands/${id}`).then((r) => r.data),
    enabled: isAuthenticated && !!id,
  });

  // Sellers need their stall ID to submit offers
  const { data: merchant } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data).catch(() => null),
    enabled: isAuthenticated && ['STALL_OWNER', 'ATTENDANT'].includes(user?.role ?? ''),
  });

  const stallId = merchant?.stalls?.[0]?.id ?? '';

  const submitOffer = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/demands/${id}/offers`, {
        stallId,
        totalPrice: parseFloat(offerForm.totalPrice),
        message: offerForm.message || undefined,
        items: [], // sellers can detail items optionally
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Offer submitted!');
      setOfferOpen(false);
      setOfferForm({ message: '', totalPrice: '', stallId: '' });
      queryClient.invalidateQueries({ queryKey: ['demand', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to submit offer'),
  });

  const acceptOffer = useMutation({
    mutationFn: (offerId: string) =>
      api.post(`/api/v1/demands/offers/${offerId}/accept`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Offer accepted! Head to the stall to collect and pay.');
      queryClient.invalidateQueries({ queryKey: ['demand', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to accept offer'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !demand) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-brand-red" />
        <p className="text-navy-700 font-bold">Demand not found</p>
        <Link href="/demands" className="btn-primary">Back to Demands</Link>
      </div>
    );
  }

  const isBuyer = demand.buyer?.id === user?.id;
  const isSeller = ['STALL_OWNER', 'ATTENDANT'].includes(user?.role ?? '');
  const isOpen = demand.status === 'OPEN';

  const statusColors: Record<string, string> = {
    OPEN: 'badge-live',
    MATCHED: 'badge-bid',
    FULFILLED: 'badge-success',
    EXPIRED: 'badge-danger',
    CLOSED: 'bg-gray-100 text-gray-600 border border-gray-200',
  };

  const urgencyColors: Record<string, string> = {
    HIGH: 'text-brand-red bg-red-50',
    MEDIUM: 'text-brand-orange bg-orange-50',
    LOW: 'text-brand-blue bg-blue-50',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/demands" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Demand Details</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Demand card */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Gavel className="w-6 h-6 text-brand-orange" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`badge text-[10px] ${statusColors[demand.status] || statusColors.CLOSED}`}>{demand.status}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${urgencyColors[demand.urgency] || urgencyColors.MEDIUM}`}>{demand.urgency}</span>
              </div>
              <h2 className="font-black text-navy-700 text-lg leading-tight">{demand.title}</h2>
            </div>
          </div>

          {demand.description && (
            <p className="text-sm text-gray-600 mb-4">{demand.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Budget Range</p>
              <p className="font-black text-navy-700">{formatCurrency(parseFloat(demand.minBudget || 0))} – {formatCurrency(parseFloat(demand.maxBudget))}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Offers</p>
              <p className="font-black text-navy-700">{demand.offers?.length ?? 0} received</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            Posted {new Date(demand.createdAt).toLocaleDateString()} · Expires {new Date(demand.expiresAt).toLocaleDateString()}
          </div>
        </div>

        {/* Submit offer — sellers only, demand must be open */}
        {isSeller && isOpen && stallId && (
          <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
            <button
              onClick={() => setOfferOpen((o) => !o)}
              className="w-full flex items-center justify-between px-6 py-4 font-bold text-navy-700 hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-2"><Gavel className="w-5 h-5 text-brand-green" /> Submit Your Offer</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${offerOpen ? 'rotate-180' : ''}`} />
            </button>
            {offerOpen && (
              <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="label">Your Price ($) <span className="text-brand-red">*</span></label>
                  <input
                    type="number"
                    className="input"
                    placeholder="e.g. 25.00"
                    min="0"
                    step="0.01"
                    value={offerForm.totalPrice}
                    onChange={(e) => setOfferForm((f) => ({ ...f, totalPrice: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Message to buyer</label>
                  <textarea
                    className="input min-h-[80px] resize-none"
                    placeholder="Tell the buyer what you have and when they can collect..."
                    value={offerForm.message}
                    onChange={(e) => setOfferForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>
                <button
                  onClick={() => submitOffer.mutate()}
                  disabled={!offerForm.totalPrice || submitOffer.isPending}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {submitOffer.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Gavel className="w-4 h-4" /> Submit Offer</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Offers list */}
        <div>
          <h3 className="font-black text-lg text-navy-700 mb-3">Offers ({demand.offers?.length ?? 0})</h3>
          {(demand.offers || []).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 text-center py-10">
              <Gavel className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No offers yet. Sellers will respond soon.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {demand.offers.map((offer: any) => {
                const offerStatusColor: Record<string, string> = {
                  PENDING: 'badge-bid',
                  ACCEPTED: 'badge-success',
                  REJECTED: 'badge-danger',
                };
                return (
                  <div key={offer.id} className={`bg-white rounded-2xl border-2 p-5 ${offer.status === 'ACCEPTED' ? 'border-brand-green' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`badge text-[10px] ${offerStatusColor[offer.status] || 'badge-bid'}`}>{offer.status}</span>
                          <span className="text-xl font-black text-navy-700">{formatCurrency(parseFloat(offer.totalPrice))}</span>
                        </div>
                        {offer.message && <p className="text-sm text-gray-600">{offer.message}</p>}
                        <p className="text-xs text-gray-400 mt-1">{new Date(offer.createdAt).toLocaleDateString()}</p>
                      </div>
                      {isBuyer && offer.status === 'PENDING' && isOpen && (
                        <button
                          onClick={() => acceptOffer.mutate(offer.id)}
                          disabled={acceptOffer.isPending}
                          className="btn-primary text-sm py-2.5 px-4 flex items-center gap-2 flex-shrink-0"
                        >
                          {acceptOffer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Accept
                        </button>
                      )}
                    </div>
                    {offer.status === 'ACCEPTED' && (
                      <div className="mt-3 bg-green-50 rounded-xl px-4 py-3 text-sm text-brand-green font-semibold">
                        Offer accepted — head to the stall to collect and pay the seller directly.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
