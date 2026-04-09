'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Logo } from '@/components/Logo';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

/**
 * Paynow redirects the user to this page after a web (card/Zipit) payment.
 * The URL contains ?reference=... and ?status=... from Paynow.
 * We poll our backend to confirm the payment before showing success.
 */
function ReturnPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const reference = params.get('reference') || '';
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking');
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!reference) { setStatus('failed'); return; }

    pollRef.current = setInterval(async () => {
      pollCount.current++;
      if (pollCount.current > 24) { // 2 minutes
        clearInterval(pollRef.current!);
        setStatus('failed');
        return;
      }
      try {
        const { data } = await api.get(`/api/v1/payments/status/${reference}`);
        if (data.paid) {
          clearInterval(pollRef.current!);
          setStatus('success');
        } else if (['FAILED', 'CANCELLED', 'DISPUTED'].includes(data.status)) {
          clearInterval(pollRef.current!);
          setStatus('failed');
        }
      } catch { /* keep trying */ }
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [reference]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Logo size={40} />
        <div className="mt-8 bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <Loader2 className="w-12 h-12 text-brand-orange animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-black text-navy-700 mb-2">Confirming Payment</h2>
          <p className="text-gray-500 text-sm">Please wait while we verify your payment with Paynow...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Logo size={40} />
        <div className="mt-8 bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <CheckCircle2 className="w-14 h-14 text-brand-green mx-auto mb-4" />
          <h2 className="text-2xl font-black text-navy-700 mb-2">Deposit Confirmed!</h2>
          <p className="text-gray-500 mb-6">Your wallet has been topped up successfully.</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary w-full py-4 text-base">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <Logo size={40} />
      <div className="mt-8 bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
        <XCircle className="w-14 h-14 text-brand-red mx-auto mb-4" />
        <h2 className="text-2xl font-black text-navy-700 mb-2">Payment Not Completed</h2>
        <p className="text-gray-500 mb-6">Your payment was not confirmed. No money was taken from your account.</p>
        <button onClick={() => router.push('/wallet/deposit')} className="btn-primary w-full py-4 text-base mb-3">
          Try Again
        </button>
        <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-400 hover:text-gray-600 w-full py-2">
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" /></div>}>
      <ReturnPageContent />
    </Suspense>
  );
}
