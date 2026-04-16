'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Printer, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ServiceInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const router        = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading     = useAuthStore((s) => s.isLoading);
  const currentUserId   = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data: inv, isLoading } = useQuery({
    queryKey: ['svc-invoice', invoiceId],
    queryFn: () => api.get(`/api/v1/services/invoices/${invoiceId}`).then((r) => r.data),
    enabled: isAuthenticated && !!invoiceId,
  });

  const markPaidMut = useMutation({
    mutationFn: () =>
      api.patch(`/api/v1/services/invoices/${invoiceId}/paid`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Invoice marked as paid');
      qc.invalidateQueries({ queryKey: ['svc-invoice', invoiceId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  if (isLoading || !inv) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-semibold">
        Loading…
      </div>
    );
  }

  const d = inv.data as any; // stored JSON blob
  const isProvider = inv.quote?.request?.listing?.providerId === currentUserId;
  const isPaid     = inv.status === 'PAID';

  const issueDate = new Date(d.date ?? inv.createdAt);

  return (
    <div className="min-h-screen bg-gray-100 pb-16 print:bg-white print:pb-0">
      {/* Screen-only toolbar */}
      <header className="bg-white border-b border-gray-100 safe-area-top sticky top-0 z-10 print:hidden">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-50 text-navy-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="font-black text-navy-700 text-sm">Invoice</span>
          </div>
          <div className="flex items-center gap-2">
            {isProvider && !isPaid && (
              <button
                onClick={() => markPaidMut.mutate()}
                disabled={markPaidMut.isPending}
                className="flex items-center gap-1.5 rounded-xl bg-green-600 text-white font-bold text-xs py-2 px-3 disabled:opacity-60"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Mark Paid
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-gray-100 text-navy-700 font-bold text-xs py-2 px-3"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>
      </header>

      {/* Invoice document */}
      <div className="max-w-2xl mx-auto px-4 py-6 print:px-0 print:py-0 print:max-w-none">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 print:rounded-none print:shadow-none print:border-0">

          {/* Header: branding + invoice number */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <Logo size={36} />
              <p className="text-xs text-gray-400 mt-1">www.mall263.com</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Invoice</p>
              <p className="font-black text-navy-700 text-lg">{d.invoiceNumber}</p>
              <p className="text-xs text-gray-500 mt-1">
                {issueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {isPaid ? 'PAID' : 'PENDING'}
              </span>
            </div>
          </div>

          {/* Provider + Client */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">From</p>
              {d.storeLogoUrl && (
                <div className="w-12 h-12 rounded-xl overflow-hidden relative mb-2">
                  <Image src={d.storeLogoUrl} alt="" fill className="object-cover" sizes="48px" />
                </div>
              )}
              <p className="font-black text-navy-700 text-sm">{d.businessName ?? d.providerName}</p>
              {d.providerName !== d.businessName && (
                <p className="text-xs text-gray-500">{d.providerName}</p>
              )}
              {d.stallName && <p className="text-xs text-gray-500">{d.stallName}{d.stallNumber ? ` #${d.stallNumber}` : ''}</p>}
              {d.mallName && <p className="text-xs text-gray-500">{d.mallName}{d.mallCity ? `, ${d.mallCity}` : ''}</p>}
              {d.stallAddress && !d.mallName && <p className="text-xs text-gray-500">{d.stallAddress}</p>}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</p>
              <p className="font-black text-navy-700 text-sm">{d.clientName}</p>
              {d.clientPhone && <p className="text-xs text-gray-500">{d.clientPhone}</p>}
            </div>
          </div>

          {/* Line item */}
          <div className="border-t border-gray-100 pt-5 mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="text-left pb-2">Service</th>
                  <th className="text-right pb-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 pr-4">
                    <p className="font-bold text-navy-700">{d.serviceTitle}</p>
                    {d.quoteDescription && (
                      <p className="text-xs text-gray-500 mt-0.5">{d.quoteDescription}</p>
                    )}
                    {d.estimatedDays && (
                      <p className="text-xs text-gray-400">Est. {d.estimatedDays} day{d.estimatedDays !== 1 ? 's' : ''}</p>
                    )}
                  </td>
                  <td className="py-2 text-right font-black text-navy-700">
                    {formatCurrency(Number(d.amount))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="border-t-2 border-gray-100 pt-4 flex justify-between items-center mb-6">
            <p className="font-bold text-gray-500 text-sm">Total Due</p>
            <p className="font-black text-navy-700 text-2xl">{formatCurrency(Number(d.amount))}</p>
          </div>

          {/* Payment method */}
          <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500">Payment Method</p>
            <p className="text-xs font-black text-navy-700 uppercase">{d.paymentMethod}</p>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-gray-400 mt-8">
            Generated by {d.appName} · www.mall263.com
          </p>
        </div>
      </div>
    </div>
  );
}
