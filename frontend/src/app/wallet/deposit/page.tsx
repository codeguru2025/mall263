'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { generateIdempotencyKey } from '@/lib/idempotency';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Smartphone, CreditCard, Loader2, CheckCircle2, XCircle, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';

type Method = 'ecocash' | 'onemoney' | 'telecash' | 'web';

const METHODS: { id: Method; label: string; icon: string; desc: string }[] = [
  { id: 'ecocash',  label: 'EcoCash',    icon: '🟢', desc: 'Econet mobile money — USSD push to your phone' },
  { id: 'onemoney', label: 'OneMoney',   icon: '🔴', desc: 'NetOne mobile money — USSD push to your phone' },
  { id: 'telecash', label: 'Telecash',   icon: '🔵', desc: 'Telecel mobile money — USSD push to your phone' },
  { id: 'web',      label: 'Card / Zipit', icon: '💳', desc: 'Visa, Mastercard or Zipit bank transfer' },
];

type Stage = 'form' | 'processing' | 'success' | 'failed' | 'timeout';

export default function DepositPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('ecocash');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [reference, setReference] = useState('');
  const [instructions, setInstructions] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollCount = useRef(0);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const isMobile = method !== 'web';

  // ── Initiate payment ───────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = generateIdempotencyKey();
      if (isMobile) {
        return api.post('/api/v1/payments/initiate/mobile', {
          amount: parseFloat(amount),
          phone,
          method,
        }, { headers: { 'Idempotency-Key': idempotencyKey } }).then((r) => r.data);
      } else {
        return api.post('/api/v1/payments/initiate/web', {
          amount: parseFloat(amount),
        }, { headers: { 'Idempotency-Key': idempotencyKey } }).then((r) => r.data);
      }
    },
    onSuccess: (data) => {
      if (data.redirectUrl) {
        // Card / Zipit — redirect to Paynow
        window.location.href = data.redirectUrl;
        return;
      }
      // Mobile — show instructions and start polling
      setReference(data.reference);
      setInstructions(data.instructions || `Check your phone for the ${method.toUpperCase()} prompt and enter your PIN.`);
      setStage('processing');
      startPolling(data.reference);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to initiate payment'),
  });

  const startPolling = (ref: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollCount.current = 0;
    pollRef.current = setInterval(async () => {
      pollCount.current++;
      // Stop after 5 minutes (60 × 5s)
      if (pollCount.current > 60) {
        clearInterval(pollRef.current!);
        setStage('timeout');
        return;
      }
      try {
        const { data } = await api.get(`/api/v1/payments/status/${ref}`);
        if (data.paid) {
          clearInterval(pollRef.current!);
          setStage('success');
        } else if (['FAILED', 'CANCELLED', 'DISPUTED'].includes(data.status)) {
          clearInterval(pollRef.current!);
          setStage('failed');
        }
      } catch { /* ignore poll errors — keep trying */ }
    }, 5000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Block scientific notation (1e5), commas, or other non-numeric chars
    if (!amount || !/^\d+(\.\d{0,2})?$/.test(amount)) {
      toast.error('Enter a valid dollar amount (e.g. 10.00)'); return;
    }
    const parsed = parseFloat(amount);
    if (parsed < 1) { toast.error('Minimum deposit is $1.00'); return; }
    if (parsed > 10000) { toast.error('Maximum single deposit is $10,000'); return; }
    if (isMobile && !phone) { toast.error('Enter your mobile number'); return; }
    mutation.mutate();
  };

  if (authLoading) return null;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-brand-green" />
          </div>
          <h2 className="text-2xl font-black text-navy-700 mb-2">Deposit Successful!</h2>
          <p className="text-gray-500 mb-6">${parseFloat(amount).toFixed(2)} has been added to your wallet.</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary w-full py-4 text-base">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Failed screen ──────────────────────────────────────────────────────────
  if (stage === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-10 h-10 text-brand-red" />
          </div>
          <h2 className="text-2xl font-black text-navy-700 mb-2">Payment Failed</h2>
          <p className="text-gray-500 mb-6">The payment was not completed. No money was taken from your account.</p>
          <button onClick={() => setStage('form')} className="btn-primary w-full py-4 text-base mb-3">
            Try Again
          </button>
          <Link href="/dashboard" className="block text-sm text-gray-400 hover:text-gray-600">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Timeout screen ─────────────────────────────────────────────────────────
  if (stage === 'timeout') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-10 h-10 text-brand-orange" />
          </div>
          <h2 className="text-2xl font-black text-navy-700 mb-2">Payment not confirmed</h2>
          <p className="text-gray-500 mb-6">We could not confirm your payment after 5 minutes. If money was deducted, please contact support with your reference.</p>
          <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs text-gray-400 mb-1">Reference</p>
            <p className="font-mono text-sm text-navy-700 font-bold">{reference}</p>
          </div>
          <button onClick={() => setStage('form')} className="btn-primary w-full py-4 text-base mb-3">
            Try Again
          </button>
          <button
            onClick={() => { if (reference) startPolling(reference); }}
            className="btn-secondary w-full py-4 text-base"
          >
            Check Status
          </button>
        </div>
      </div>
    );
  }

  // ── Processing screen (mobile only) ────────────────────────────────────────
  if (stage === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border-2 border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
          </div>
          <h2 className="text-2xl font-black text-navy-700 mb-2">Waiting for Payment</h2>
          <p className="text-gray-500 mb-4">{instructions}</p>
          <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
            <p className="text-xs text-gray-400 mb-1">Reference</p>
            <p className="font-mono text-sm text-navy-700 font-bold">{reference}</p>
            <p className="text-xs text-gray-400 mt-3 mb-1">Amount</p>
            <p className="font-black text-xl text-navy-700">${parseFloat(amount).toFixed(2)}</p>
          </div>
          <p className="text-xs text-gray-400">This page will update automatically once payment is confirmed. Do not close it.</p>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Deposit Funds</h1>
            <p className="text-xs text-gray-500">Add money to your Mall263 wallet</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 pb-28">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Amount */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-brand-orange" />
              </div>
              <h2 className="font-black text-navy-700">Amount</h2>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-gray-400">$</span>
              <input
                type="text"
                inputMode="decimal"
                className="input pl-9 text-2xl font-black"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2 mt-3">
              {[5, 10, 20, 50].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                    amount === String(v)
                      ? 'border-brand-orange bg-orange-50 text-brand-orange'
                      : 'border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-brand-blue" />
              </div>
              <h2 className="font-black text-navy-700">Payment Method</h2>
            </div>
            <div className="space-y-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    method === m.id
                      ? 'border-brand-orange bg-orange-50'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-navy-700 text-sm">{m.label}</div>
                    <div className="text-xs text-gray-500">{m.desc}</div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    method === m.id ? 'border-brand-orange bg-brand-orange' : 'border-gray-300'
                  }`} />
                </button>
              ))}
            </div>
          </div>

          {/* Phone number (mobile only) */}
          {isMobile && (
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <label className="label">
                {method === 'ecocash' ? 'EcoCash' : method === 'onemoney' ? 'OneMoney' : 'Telecash'} Number
                <span className="text-brand-red"> *</span>
              </label>
              <input
                type="tel"
                className="input"
                placeholder="e.g. 0771 234 567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required={isMobile}
              />
              <p className="text-xs text-gray-400 mt-2">
                You will receive a USSD prompt on this number to approve the payment.
              </p>
            </div>
          )}

          {/* Web payment info */}
          {!isMobile && (
            <div className="bg-blue-50 rounded-2xl border-2 border-blue-100 p-4 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-brand-blue flex-shrink-0 mt-0.5" />
              <p className="text-sm text-brand-blue">
                You will be redirected to the secure Paynow payment page to complete your card or Zipit transfer.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
          >
            {mutation.isPending
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Connecting to Paynow...</>
              : <><Wallet className="w-5 h-5" /> Deposit ${parseFloat(amount || '0').toFixed(2)}</>
            }
          </button>

          <p className="text-center text-xs text-gray-400">
            Payments are processed securely by Paynow Zimbabwe. Mall263 does not store your card or mobile money details.
          </p>
        </form>
      </div>
    </div>
  );
}
