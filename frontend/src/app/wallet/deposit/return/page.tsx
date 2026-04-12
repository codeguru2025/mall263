'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Logo } from '@/components/Logo';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type ReturnState = 'checking' | 'success' | 'failed' | 'uncertain';

/**
 * Paynow redirects the user here after a web (card/Zipit) payment.
 * Query params vary; we poll the backend until the wallet is credited or we time out.
 */
function ReturnPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const reference =
    params.get('reference') ||
    params.get('ref') ||
    params.get('paynowreference') ||
    params.get('PaynowReference') ||
    '';
  const paynowStatus = (params.get('status') || params.get('paynowstatus') || '').toLowerCase();

  const [status, setStatus] = useState<ReturnState>('checking');
  const [hint, setHint] = useState('Verifying with Paynow…');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCount = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      return;
    }

    if (['failed', 'cancelled', 'disputed'].includes(paynowStatus)) {
      setStatus('failed');
      return;
    }

    const poll = async () => {
      if (cancelled.current) return;
      pollCount.current++;
      if (pollCount.current > 80) {
        setStatus('uncertain');
        return;
      }
      try {
        const { data } = await api.get(`/api/v1/payments/status/${encodeURIComponent(reference)}`, {
          timeout: 20_000,
        });
        if (data.paid) {
          setStatus('success');
          return;
        }
        if (['FAILED', 'CANCELLED', 'DISPUTED', 'REFUNDED'].includes(data.status)) {
          setStatus('failed');
          return;
        }
        if (data.status === 'NOT_FOUND' && pollCount.current > 15) {
          setHint('Still confirming… If your dashboard balance went up, the deposit succeeded.');
        } else if (data.status === 'POLL_ERROR') {
          setHint('Paynow is slow to respond — still trying…');
        } else {
          setHint(`Checking payment… (${pollCount.current})`);
        }
      } catch (e: any) {
        if (e?.response?.status === 401) {
          toast.error('Session expired. Log in and check your wallet on the dashboard.');
          setStatus('uncertain');
          return;
        }
        setHint('Connection issue — retrying…');
      }
      timerRef.current = setTimeout(poll, 2500);
    };

    void poll();
    return () => {
      cancelled.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [reference, paynowStatus]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Logo size={40} />
        <div className="mt-8 bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <Loader2 className="w-12 h-12 text-brand-orange animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-black text-navy-700 mb-2">Confirming payment</h2>
          <p className="text-gray-500 text-sm mb-2">{hint}</p>
          <p className="text-xs text-gray-400">
            Do not refresh. This usually takes a few seconds after you pay.
          </p>
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
          <h2 className="text-2xl font-black text-navy-700 mb-2">Deposit confirmed</h2>
          <p className="text-gray-500 mb-6">Your wallet has been topped up.</p>
          <button type="button" onClick={() => router.push('/dashboard')} className="btn-primary w-full py-4 text-base">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === 'uncertain') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <Logo size={40} />
        <div className="mt-8 bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <Loader2 className="w-12 h-12 text-brand-blue animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-black text-navy-700 mb-2">Could not confirm automatically</h2>
          <p className="text-gray-500 text-sm mb-4">
            Open your dashboard and check your wallet balance. If the deposit appears, no further action is needed.
          </p>
          <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-left">
            <p className="text-xs text-gray-400 mb-1">Reference</p>
            <p className="font-mono text-xs text-navy-700 font-bold break-all">{reference}</p>
          </div>
          <button type="button" onClick={() => router.push('/dashboard')} className="btn-primary w-full py-4 text-base mb-3">
            Open dashboard
          </button>
          <button type="button" onClick={() => router.push('/wallet/deposit')} className="text-sm text-gray-400 hover:text-gray-600 w-full py-2">
            Back to deposit
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
        <h2 className="text-2xl font-black text-navy-700 mb-2">Payment not completed</h2>
        <p className="text-gray-500 mb-6 text-sm">
          We did not receive a successful confirmation. If you were not charged, you can try again.
        </p>
        <button type="button" onClick={() => router.push('/wallet/deposit')} className="btn-primary w-full py-4 text-base mb-3">
          Try again
        </button>
        <button type="button" onClick={() => router.push('/dashboard')} className="text-sm text-gray-400 hover:text-gray-600 w-full py-2">
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading…</p>
        </div>
      }
    >
      <ReturnPageContent />
    </Suspense>
  );
}
