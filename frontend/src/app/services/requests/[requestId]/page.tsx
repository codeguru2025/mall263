'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, CheckCircle, XCircle, MessageCircle, FileText, ClipboardCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUS_COLOR: Record<string, string> = {
  OPEN:      'bg-blue-50 text-blue-700',
  QUOTED:    'bg-amber-50 text-amber-700',
  ACCEPTED:  'bg-green-50 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-600',
};

const QUOTE_STATUS_COLOR: Record<string, string> = {
  PENDING:   'bg-amber-50 text-amber-700',
  ACCEPTED:  'bg-green-50 text-green-700',
  REJECTED:  'bg-red-50 text-red-600',
  WITHDRAWN: 'bg-gray-100 text-gray-500',
};

export default function ServiceRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading     = useAuthStore((s) => s.isLoading);
  const currentUserId   = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data: req, isLoading } = useQuery({
    queryKey: ['service-request', requestId],
    queryFn: () => api.get(`/api/v1/services/requests/${requestId}`).then((r) => r.data),
    enabled: isAuthenticated && !!requestId,
  });

  const acceptMut = useMutation({
    mutationFn: (quoteId: string) =>
      api.post(`/api/v1/services/quotes/${quoteId}/accept`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Quote accepted! Chat is now open.');
      qc.invalidateQueries({ queryKey: ['service-request', requestId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: (quoteId: string) =>
      api.post(`/api/v1/services/quotes/${quoteId}/reject`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Quote rejected.');
      qc.invalidateQueries({ queryKey: ['service-request', requestId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const completeMut = useMutation({
    mutationFn: ({ quoteId, paymentMethod }: { quoteId: string; paymentMethod: string }) =>
      api.post(`/api/v1/services/quotes/${quoteId}/complete`, { paymentMethod }).then((r) => r.data),
    onSuccess: (inv) => {
      toast.success('Service marked complete! Invoice generated.');
      qc.invalidateQueries({ queryKey: ['service-request', requestId] });
      router.push(`/services/invoice/${inv.id}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  if (isLoading || !req) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-semibold">
        Loading…
      </div>
    );
  }

  const isClient   = req.clientId === currentUserId;
  const isProvider = req.listing?.providerId === currentUserId;

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <header className="bg-white border-b border-gray-100 safe-area-top sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/services/requests" className="p-2 rounded-xl hover:bg-gray-50 text-navy-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-black text-navy-700 text-sm">Request Detail</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Service info */}
        <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5 text-brand-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 justify-between">
              <p className="font-black text-navy-700 text-sm truncate">{req.listing?.title}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLOR[req.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {req.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isClient
                ? `Provider: ${req.listing?.provider?.firstName} ${req.listing?.provider?.lastName}`
                : `Client: ${req.client?.firstName} ${req.client?.lastName}`}
            </p>
            {req.notes && <p className="text-xs text-gray-600 mt-2 italic">&ldquo;{req.notes}&rdquo;</p>}
            {req.budgetHint && (
              <p className="text-xs text-gray-500 mt-1">
                Budget hint: <span className="font-bold text-navy-700">{formatCurrency(Number(req.budgetHint))}</span>
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">{formatDate(req.createdAt)}</p>
          </div>
        </div>

        {/* Quotes */}
        {req.quotes?.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quotes</p>
            {req.quotes.map((q: any) => (
              <div key={q.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-black text-brand-green text-lg">{formatCurrency(Number(q.amount))}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${QUOTE_STATUS_COLOR[q.status] ?? 'bg-gray-100'}`}>
                    {q.status}
                  </span>
                </div>
                {q.description && <p className="text-sm text-gray-600">{q.description}</p>}
                {q.estimatedDays && (
                  <p className="text-xs text-gray-500">Estimated: {q.estimatedDays} day{q.estimatedDays !== 1 ? 's' : ''}</p>
                )}

                {/* Client actions: accept/reject pending quote */}
                {isClient && q.status === 'PENDING' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => acceptMut.mutate(q.id)}
                      disabled={acceptMut.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-600 text-white font-bold text-xs py-2.5 disabled:opacity-60"
                    >
                      <CheckCircle className="w-4 h-4" /> Accept
                    </button>
                    <button
                      onClick={() => rejectMut.mutate(q.id)}
                      disabled={rejectMut.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-50 text-red-600 font-bold text-xs py-2.5 border border-red-100 disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}

                {/* Chat link once accepted */}
                {q.status === 'ACCEPTED' && (
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <Link
                      href={`/services/chat/room?quoteId=${q.id}`}
                      className="flex items-center gap-1.5 rounded-xl bg-brand-blue text-white font-bold text-xs py-2.5 px-4"
                    >
                      <MessageCircle className="w-4 h-4" /> Open Chat
                    </Link>
                    {q.invoice && (
                      <Link
                        href={`/services/invoice/${q.invoice.id}`}
                        className="flex items-center gap-1.5 rounded-xl bg-gray-100 text-navy-700 font-bold text-xs py-2.5 px-4"
                      >
                        <FileText className="w-4 h-4" /> View Invoice
                      </Link>
                    )}
                    {/* Provider: mark complete */}
                    {isProvider && !q.invoice && req.status !== 'COMPLETED' && (
                      <button
                        onClick={() => completeMut.mutate({ quoteId: q.id, paymentMethod: 'CASH' })}
                        disabled={completeMut.isPending}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-500 text-white font-bold text-xs py-2.5 px-4 disabled:opacity-60"
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        {completeMut.isPending ? 'Processing…' : 'Mark Complete'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Provider: no quotes yet, prompt them to open the chat detail */}
        {isProvider && req.quotes?.length === 0 && req.status === 'OPEN' && (
          <Link
            href={`/services/quotes/new?requestId=${req.id}`}
            className="flex items-center justify-center gap-2 w-full rounded-2xl bg-brand-blue text-white font-black text-sm py-4"
          >
            Submit a Quote
          </Link>
        )}
      </div>
    </div>
  );
}
