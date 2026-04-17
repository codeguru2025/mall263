'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, CheckCircle2, Smartphone, AlertCircle, Gift, Lock, Star, Tag, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface SubscribeModalProps {
  onClose?: () => void;
  dismissible?: boolean;
  trialExpired?: boolean;
  trialEndsAt?: string;
}

interface Plan {
  id: string;
  name: string;
  priceUsd: string;
  trialDays: number;
  description: string | null;
  features: string[];
}

interface PromoResult {
  valid: boolean;
  reason?: string;
  discountPct?: number | null;
  discountAmt?: number | null;
  description?: string | null;
}

export default function SubscribeModal({
  onClose,
  dismissible = true,
  trialExpired = false,
  trialEndsAt,
}: SubscribeModalProps) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [step, setStep] = useState<'phone' | 'waiting' | 'done' | 'timeout' | 'uncertain'>('phone');
  const [reference, setReference] = useState('');
  const [finalPrice, setFinalPrice] = useState<number | null>(null);
  const [pollHint, setPollHint] = useState('');
  const [flowBusy, setFlowBusy] = useState(false);
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['subscription-plans-public'],
    queryFn: () => api.get('/api/v1/subscriptions/plans').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // Use first active plan; fall back to hardcoded defaults
  const plan = plans?.[0];
  const planPrice = plan ? Number(plan.priceUsd) : 5;
  const planTrialDays = plan?.trialDays ?? 7;
  const planFeatures: string[] = plan?.features?.length
    ? plan.features
    : ['Full POS & sales management', 'Inventory tracking & reports', 'Customer chat & demand alerts'];

  // Compute displayed price after promo
  const displayPrice =
    promoResult?.valid && finalPrice != null
      ? finalPrice
      : promoResult?.valid && promoResult.discountPct
      ? Math.max(0.01, planPrice * (1 - promoResult.discountPct / 100))
      : promoResult?.valid && promoResult.discountAmt
      ? Math.max(0.01, planPrice - promoResult.discountAmt)
      : planPrice;

  // Promo code validation (debounced)
  useEffect(() => {
    if (!promoCode.trim()) {
      setPromoResult(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setPromoChecking(true);
      try {
        const res = await api.get(`/api/v1/subscriptions/promo/validate?code=${encodeURIComponent(promoCode.trim())}`, { timeout: 10_000 });
        setPromoResult(res.data);
      } catch {
        setPromoResult(null);
      } finally {
        setPromoChecking(false);
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [promoCode]);

  // Poll loop
  useEffect(() => {
    if (step !== 'waiting' || !reference) return;
    cancelled.current = false;

    const poll = async () => {
      if (cancelled.current) return;
      pollCount.current++;
      if (pollCount.current > 80) { setStep('uncertain'); return; }
      try {
        const res = await api.get(`/api/v1/subscriptions/poll/${encodeURIComponent(reference)}`, { timeout: 20_000 });
        if (res.data.paid) {
          setStep('done');
          queryClient.invalidateQueries({ queryKey: ['subscription'] });
          return;
        }
        if (['FAILED', 'CANCELLED', 'DISPUTED', 'REFUNDED'].includes(res.data.status)) {
          setStep('timeout'); return;
        }
        setPollHint(
          res.data.status === 'POLL_ERROR' ? 'EcoCash gateway slow — still checking…' :
          res.data.status === 'NOT_FOUND'  ? 'Looking up your payment…' :
          `Waiting for confirmation… (${pollCount.current})`,
        );
      } catch (e: any) {
        if (e?.response?.status === 401) {
          toast.error('Session expired. Log in again, then check subscription on your dashboard.');
          setStep('uncertain'); return;
        }
        setPollHint('Network issue — retrying…');
      }
      timerRef.current = setTimeout(poll, 2500);
    };

    pollCount.current = 0;
    setPollHint('Sent to your phone — enter your EcoCash PIN when prompted.');
    void poll();

    return () => {
      cancelled.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, reference, queryClient]);

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) { toast.error('Enter a valid EcoCash number'); return; }
    setFlowBusy(true);
    try {
      await api.post('/api/v1/subscriptions/ecocash', { ecocashNumber: phone }, { timeout: 30_000 });
      const { data } = await api.post(
        '/api/v1/subscriptions/pay',
        { promoCode: promoCode.trim() || undefined },
        { timeout: 45_000 },
      );
      setReference(data.reference);
      setFinalPrice(data.finalPrice ?? null);
      setStep('waiting');
    } catch (err: any) {
      const msg =
        err.code === 'ECONNABORTED'
          ? 'Request timed out. Check your connection and try again.'
          : err.response?.data?.message || 'Could not start payment';
      toast.error(msg);
    } finally {
      setFlowBusy(false);
    }
  };

  const trialEndDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const daysLeft = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {step === 'phone' && (
          <>
            {/* Header */}
            {trialExpired ? (
              <div className="bg-gradient-to-br from-brand-orange to-orange-600 px-6 pt-8 pb-6 text-white text-center">
                <div className="w-14 h-14 bg-white/15 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-black mb-1">Your Free Trial Ended</h2>
                <p className="text-white/75 text-sm">Subscribe to keep full access to all features</p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-navy-700 to-navy-900 px-6 pt-8 pb-6 text-white text-center">
                <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Gift className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-black mb-1">
                  {plan?.name ? `${plan.name} Plan` : 'Subscribe & Keep Going'}
                </h2>
                <p className="text-white/60 text-sm">
                  {daysLeft > 0
                    ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your ${planTrialDays}-day free trial`
                    : 'Unlock all features'}
                </p>
              </div>
            )}

            {/* Plan benefits */}
            <div className="px-6 pt-4 pb-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">What&apos;s included</p>
              <ul className="space-y-2 mb-4">
                {planFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-navy-700">
                    <Star className="w-3.5 h-3.5 text-brand-orange flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Price display */}
              <div className="text-center mb-3">
                {promoResult?.valid ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-gray-400 line-through font-semibold">${planPrice.toFixed(2)}</span>
                    <span className="text-navy-700 font-black text-lg">${displayPrice.toFixed(2)}</span>
                    <span className="text-xs text-brand-green font-bold">/ month</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 font-semibold">
                    Only <span className="text-navy-700 font-black">${planPrice.toFixed(2)} / month</span> · Billed via EcoCash
                  </div>
                )}
                {promoResult?.valid && promoResult.description && (
                  <p className="text-xs text-brand-green mt-0.5">{promoResult.description}</p>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="px-6 pb-6 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">EcoCash Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0773 000 000"
                  className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-navy-700 font-semibold text-sm focus:border-brand-green outline-none transition-colors"
                />
                <p className="text-xs text-gray-400 mt-1">You&apos;ll receive a USSD prompt to enter your PIN.</p>
              </div>

              {/* Promo code */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">Promo / Referral Code (optional)</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME20"
                    className={`w-full border-2 rounded-xl pl-9 pr-9 py-3 text-navy-700 font-semibold text-sm outline-none transition-colors ${
                      promoResult?.valid
                        ? 'border-brand-green bg-green-50'
                        : promoResult && !promoResult.valid
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-100 focus:border-brand-green'
                    }`}
                  />
                  {promoChecking && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                  {!promoChecking && promoResult?.valid && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-green" />
                  )}
                  {!promoChecking && promoResult && !promoResult.valid && promoCode && (
                    <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                  )}
                </div>
                {promoResult && !promoResult.valid && promoCode && (
                  <p className="text-xs text-red-500 mt-1">{promoResult.reason}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={flowBusy || !phone}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-green text-white font-black rounded-xl hover:bg-green-600 transition-colors disabled:opacity-60"
              >
                {flowBusy ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting payment…</>
                ) : (
                  `Subscribe — $${displayPrice.toFixed(2)}/month`
                )}
              </button>

              {dismissible && onClose && (
                <button type="button" onClick={onClose} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1">
                  Maybe later
                </button>
              )}
            </div>
          </>
        )}

        {step === 'waiting' && (
          <div className="px-6 py-10 text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto">
              <Smartphone className="w-8 h-8 text-brand-orange animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-navy-700 text-lg">Check your phone</h3>
              <p className="text-sm text-gray-500 mt-1">
                An EcoCash payment request was sent. Approve it with your PIN.
              </p>
              {finalPrice !== null && (
                <p className="text-sm font-black text-navy-700 mt-1">${finalPrice.toFixed(2)}</p>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-brand-orange" />
              <span>{pollHint || 'Confirming payment…'}</span>
            </div>
            <p className="text-xs text-gray-400">If nothing appears, open the EcoCash app or dial your USSD menu.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="px-6 py-10 text-center space-y-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-brand-green" />
            </div>
            <div>
              <h3 className="font-black text-navy-700 text-lg">You&apos;re all set</h3>
              <p className="text-sm text-gray-500 mt-1">Your subscription is active.</p>
            </div>
            <button
              type="button"
              onClick={() => { queryClient.invalidateQueries({ queryKey: ['subscription'] }); onClose?.(); }}
              className="w-full py-3 bg-brand-green text-white font-black rounded-xl hover:bg-green-600 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'timeout' && (
          <div className="px-6 py-10 text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-brand-red" />
            </div>
            <div>
              <h3 className="font-black text-navy-700 text-lg">Payment not confirmed</h3>
              <p className="text-sm text-gray-500 mt-1">We didn&apos;t get a success signal. If you weren&apos;t charged, try again.</p>
            </div>
            <button
              type="button"
              onClick={() => { setStep('phone'); setPollHint(''); setReference(''); }}
              className="w-full py-3 bg-brand-orange text-white font-black rounded-xl hover:bg-orange-600 transition-colors"
            >
              Try again
            </button>
            {dismissible && onClose && (
              <button type="button" onClick={onClose} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1">
                Maybe later
              </button>
            )}
          </div>
        )}

        {step === 'uncertain' && (
          <div className="px-6 py-10 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-brand-blue" />
            </div>
            <div>
              <h3 className="font-black text-navy-700 text-lg">Check your account</h3>
              <p className="text-sm text-gray-500 mt-1">
                We couldn&apos;t finish confirmation in the app. Open the dashboard — if your subscription shows active, you&apos;re done.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { queryClient.invalidateQueries({ queryKey: ['subscription'] }); onClose?.(); }}
              className="w-full py-3 bg-brand-blue text-white font-black rounded-xl hover:bg-blue-600 transition-colors"
            >
              Go to dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
