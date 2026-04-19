'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import axios from 'axios';
import { formatCurrency } from '@/lib/utils';
import { resolveStoreLogo } from '@/lib/storeBranding';
import { Logo } from '@/components/Logo';
import QRCode from 'react-qr-code';
import { Printer, ArrowLeft, CheckCircle2, XCircle, Store } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['receipt-verify', saleId],
    queryFn: () =>
      axios.get(`${API}/api/v1/pos/receipts/verify/${saleId}`).then((r) => r.data),
    enabled: !!saleId,
  });

  const receiptUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/receipts/${saleId}`
      : `https://mall263-r99jz.ondigitalocean.app/receipts/${saleId}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const authentic: boolean = data?.authentic ?? false;
  const sale = data?.receipt ?? null;

  const storeLogoUrl = sale
    ? resolveStoreLogo(sale.stall, sale.stall?.merchant)
    : null;
  const businessName = sale?.stall?.merchant?.businessName ?? null;
  const stallId = sale?.stall?.id ?? null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="print:hidden bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-navy-700" />
            </Link>
            <span className="font-black text-navy-700">Receipt</span>
          </div>
          {authentic && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-navy-700 text-white text-sm font-bold py-2.5 px-5 rounded-xl hover:bg-navy-800 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24 sm:pb-6">

        {/* Verification banner */}
        {authentic ? (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 print:hidden">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-green-800">Receipt Verified</p>
              <p className="text-xs text-green-600">This is an authentic Mall263 receipt.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-red-700">Receipt Not Found</p>
              <p className="text-xs text-red-500">This receipt could not be verified.</p>
            </div>
          </div>
        )}

        {authentic && sale && (
          <div className="bg-white rounded-2xl overflow-hidden print:shadow-none print:border-none" style={{ boxShadow: '0 2px 20px rgba(27,42,74,0.10)', border: '1px solid #dde3ee' }}>
            {/* Orange→blue accent strip */}
            <div className="h-1.5 print:hidden" style={{ background: 'linear-gradient(90deg,#F7941D 0%,#3B9AE1 100%)' }} />

            {/* Header — store logo */}
            <div className="bg-navy-700 px-6 pt-7 pb-6 text-center">
              <div className="flex justify-center mb-3">
                {storeLogoUrl ? (
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 0 0 3px rgba(247,148,29,0.5)' }}>
                    <Image src={storeLogoUrl} alt="Store logo" fill className="object-contain p-1" sizes="64px" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center" style={{ boxShadow: '0 0 0 3px rgba(247,148,29,0.4)' }}>
                    <span className="text-2xl">🏪</span>
                  </div>
                )}
              </div>
              {businessName && (
                <p className="text-xs font-bold text-white/70 tracking-wide">{businessName}</p>
              )}
              <h2 className="text-xl font-black text-white mt-1">{sale.stall?.name}</h2>
              {sale.stall?.stallNumber && (
                <p className="text-white/40 text-xs mt-1">Stall #{sale.stall.stallNumber}</p>
              )}
              {stallId && (
                <Link
                  href={`/marketplace?stall=${stallId}`}
                  className="print:hidden inline-flex items-center gap-1.5 mt-4 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
                  style={{ background: '#F7941D' }}
                >
                  <Store className="w-3.5 h-3.5" /> Visit Store
                </Link>
              )}
            </div>

            {/* Receipt number & date */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1.5px dashed #dde3ee' }}>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Receipt No.</p>
                <p className="font-black text-sm mt-1" style={{ color: '#3B9AE1' }}>{sale.receiptNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Date</p>
                <p className="font-bold text-navy-700 text-sm mt-1">
                  {new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(sale.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="px-6 py-4" style={{ borderBottom: '1.5px dashed #dde3ee' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef1f6' }}>
                    <th className="text-left pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Item</th>
                    <th className="text-center pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Qty</th>
                    <th className="text-right pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Price</th>
                    <th className="text-right pb-2 text-xs font-bold text-gray-400 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items || []).map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td className="py-2.5 text-navy-700 font-semibold">
                        {item.productName}
                        {item.variantName && item.variantName !== 'Default' && (
                          <span className="text-xs text-gray-400 ml-1">({item.variantName})</span>
                        )}
                      </td>
                      <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
                      <td className="py-2.5 text-right text-gray-500">{formatCurrency(parseFloat(item.unitPrice))}</td>
                      <td className="py-2.5 text-right font-bold text-navy-700">{formatCurrency(parseFloat(item.totalPrice))}</td>
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
                <div className="flex justify-between text-sm font-bold" style={{ color: '#43A047' }}>
                  <span>Discount</span>
                  <span>-{formatCurrency(parseFloat(sale.discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline border-t pt-3 mt-1" style={{ borderColor: '#eef1f6' }}>
                <span className="font-black text-navy-700 text-base">Total</span>
                <span className="font-black text-2xl" style={{ color: '#F7941D' }}>{formatCurrency(parseFloat(sale.totalAmount))}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Payment</span>
                <span className="font-bold text-navy-700 capitalize">{sale.paymentMethod?.replace('_', ' ').toLowerCase()}</span>
              </div>
            </div>

            {/* Footer — QR + Mall263 logo */}
            <div className="px-6 py-6 text-center" style={{ background: '#1B2A4A' }}>
              <CheckCircle2 className="w-9 h-9 mx-auto mb-2" style={{ color: '#43A047' }} />
              <p className="font-black text-white text-sm">Thank you for your purchase!</p>
              <div className="flex justify-center mt-4 mb-2">
                <div className="bg-white p-2.5 rounded-2xl inline-block">
                  <QRCode value={receiptUrl} size={100} fgColor="#1B2A4A" />
                </div>
              </div>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>Scan to verify this receipt</p>
              <div className="flex items-center justify-center gap-2">
                <Logo size={22} />
                <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Powered by Mall263</p>
              </div>
            </div>
          </div>
        )}
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
