'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, CheckCircle2, Smartphone, AlertCircle, Gift, Lock, Star } from 'lucide-react';
import toast from 'react-hot-toast';

interface SubscribeModalProps {
  onClose?: () => void;
  /** If true, show a dismiss button. If false, modal is mandatory. */
  dismissible?: boolean;
  /** Show trial-ended messaging vs. generic subscribe messaging */
  trialExpired?: boolean;
  /** ISO date string for when trial ends */
  trialEndsAt?: string;
}

export default function SubscribeModal({
  onClose,
  dismissible = true,
  trialExpired = false,
  trialEndsAt,
}: SubscribeModalProps) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'waiting' | 'done' | 'timeout' | 'uncertain'>('phone');
  const [reference, setReference] = useState('');
  const [pollHint, setPollHint] = useState('');
  const [flowBusy, setFlowBusy] = useState(false);
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (step !== 'waiting' || !reference) return;
    cancelled.current = false;

    const poll = async () => {
      if (cancelled.current) return;
      pollCount.current++;
      if (pollCount.current > 80) {
        setStep('uncertain');
        return;
      }
      try {
        const res = await api.get(`/api/v1/subscriptions/poll/${encodeURIComponent(reference)}`, { timeout: 20_000 });
        if (res.data.paid) {
          setStep('done');
          queryClient.invalidateQueries({ queryKey: ['subscription'] });
          return;
        }
        if (['FAILED', 'CANCELLED', 'DISPUTED', 'REFUNDED'].includes(res.data.status)) {
          setStep('timeout');
          return;
        }
        if (res.data.status === 'POLL_ERROR') {
          setPollHint('EcoCash gateway slow — still checking…');
        } else if (res.data.status === 'NOT_FOUND') {
          setPollHint('Looking up your payment…');
        } else {
          setPollHint(`Waiting for confirmation… (${pollCount.current})`);
        }
      } catch (e: any) {
        if (e?.response?.status === 401) {
          toast.error('Session expired. Log in again, then check subscription on your dashboard.');
          setStep('uncertain');
          return;
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
    if (digits.length < 9) {
      toast.error('Enter a valid EcoCash number');
      return;
    }
    setFlowBusy(true);
    try {
      await api.post('/api/v1/subscriptions/ecocash', { ecocashNumber: phone }, { timeout: 30_000 });
      const { data } = await api.post('/api/v1/subscriptions/pay', {}, { timeout: 45_000 });
      setReference(data.reference);
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
                <h2 className="text-xl font-black mb-1">Subscribe &amp; Keep Going</h2>
                <p className="text-white/60 text-sm">
                  {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your free trial` : 'Unlock all features'}
                </p>
              </div>
            )}

            <div className="px-6 pt-4 pb-2">
              <ul className="space-y-2 mb-4">
                {[
                  'Full POS & sales management',
                  'Inventory tracking & reports',
                  'Customer chat & demand alerts',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-navy-700">
                    <Star className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="text-center text-xs text-gray-400 mb-3 font-semibold">
                Only <span className="text-navy-700 font-black">$5 / month</span> · Billed via EcoCash
              </div>
            </div>

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

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={flowBusy || !phone}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-green text-white font-black rounded-xl hover:bg-green-600 transition-colors disabled:opacity-60"
              >
                {flowBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting payment…
                  </>
                ) : (
                  'Subscribe — $5/month'
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
