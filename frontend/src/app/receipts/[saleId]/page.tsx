'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { Printer, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => api.get(`/api/v1/pos/sales/${saleId}`).then((r) => r.data),
    enabled: !!saleId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-navy-700 font-bold">Receipt not found</p>
        <Link href="/sales" className="btn-secondary">Back to Sales</Link>
      </div>
    );
  }

  const receiptData = sale.receipt?.data as any;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/sales" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-navy-700" />
            </Link>
            <span className="font-black text-navy-700">Receipt</span>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-navy-700 text-white text-sm font-bold py-2.5 px-5 rounded-xl hover:bg-navy-800 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Receipt card */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
          {/* Header */}
          <div className="bg-navy-700 text-white px-6 pt-8 pb-6 text-center print:bg-white print:text-navy-700">
            <div className="flex justify-center mb-3">
              <Logo size={40} />
            </div>
            <p className="text-white/70 text-sm print:text-gray-500">Mall263 Marketplace</p>
            <h2 className="text-xl font-black mt-2">{sale.stall?.name}</h2>
            {sale.stall?.stallNumber && (
              <p className="text-white/60 text-xs print:text-gray-400">Stall #{sale.stall.stallNumber}</p>
            )}
          </div>

          {/* Receipt number & date */}
          <div className="px-6 py-4 border-b border-dashed border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Receipt No.</p>
              <p className="font-black text-navy-700 text-sm">{sale.receiptNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Date</p>
              <p className="font-semibold text-navy-700 text-sm">
                {new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(sale.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="px-6 py-4 border-b border-dashed border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100 pb-1">
                  <th className="text-left py-1 font-semibold">Item</th>
                  <th className="text-center py-1 font-semibold">Qty</th>
                  <th className="text-right py-1 font-semibold">Price</th>
                  <th className="text-right py-1 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(sale.items || []).map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 text-navy-700 font-medium">
                      {item.productName}
                      {item.variantName && item.variantName !== 'Default' && (
                        <span className="text-xs text-gray-400 ml-1">({item.variantName})</span>
                      )}
                    </td>
                    <td className="py-2 text-center text-gray-500">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-500">{formatCurrency(parseFloat(item.unitPrice))}</td>
                    <td className="py-2 text-right font-bold text-navy-700">{formatCurrency(parseFloat(item.totalPrice))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(parseFloat(sale.subtotal))}</span>
            </div>
            {parseFloat(sale.discountAmount) > 0 && (
              <div className="flex justify-between text-sm text-brand-green">
                <span>Discount</span>
                <span>-{formatCurrency(parseFloat(sale.discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg text-navy-700 border-t border-gray-100 pt-2 mt-2">
              <span>Total</span>
              <span>{formatCurrency(parseFloat(sale.totalAmount))}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Payment</span>
              <span className="font-semibold capitalize">{sale.paymentMethod?.replace('_', ' ').toLowerCase()}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-5 text-center border-t border-gray-100">
            <CheckCircle2 className="w-8 h-8 text-brand-green mx-auto mb-2" />
            <p className="font-bold text-navy-700 text-sm">Thank you for your purchase!</p>
            <p className="text-xs text-gray-400 mt-1">Powered by Mall263</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
