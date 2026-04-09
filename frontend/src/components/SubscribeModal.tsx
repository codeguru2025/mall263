'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, CheckCircle2, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface SubscribeModalProps {
  onClose?: () => void;
  /** If true, show a dismiss button. If false, modal is mandatory. */
  dismissible?: boolean;
}

export default function SubscribeModal({ onClose, dismissible = true }: SubscribeModalProps) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'waiting' | 'done'>('phone');
  const [reference, setReference] = useState('');
  const [pollCount, setPollCount] = useState(0);

  const saveMutation = useMutation({
    mutationFn: (ecocashNumber: string) =>
      api.post('/api/v1/subscriptions/ecocash', { ecocashNumber }).then((r) => r.data),
    onSuccess: () => {
      // Now trigger payment
      payMutation.mutate();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save number'),
  });

  const payMutation = useMutation({
    mutationFn: () => api.post('/api/v1/subscriptions/pay').then((r) => r.data),
    onSuccess: (data) => {
      setReference(data.reference);
      setStep('waiting');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Could not initiate payment'),
  });

  // Poll for payment confirmation
  useEffect(() => {
    if (step !== 'waiting' || !reference) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/v1/subscriptions/poll/${reference}`);
        if (res.data.paid) {
          setStep('done');
          queryClient.invalidateQueries({ queryKey: ['subscription'] });
          clearInterval(interval);
        }
        setPollCount((c) => c + 1);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, reference, queryClient]);

  const handleSubmit = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      toast.error('Enter a valid EcoCash number');
      return;
    }
    saveMutation.mutate(phone);
  };

  const busy = saveMutation.isPending || payMutation.isPending;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {step === 'phone' && (
          <>
            <div className="bg-gradient-to-br from-navy-700 to-navy-900 px-6 pt-8 pb-6 text-white text-center">
              <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-xl font-black mb-1">Subscribe to Continue</h2>
              <p className="text-white/60 text-sm">$5 / month · Billed via EcoCash</p>
            </div>

            <div className="px-6 py-5 space-y-4">
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
                onClick={handleSubmit}
                disabled={busy || !phone}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-green text-white font-black rounded-xl hover:bg-green-600 transition-colors disabled:opacity-60"
              >
                {busy
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  : 'Subscribe — $5/month'}
              </button>

              {dismissible && onClose && (
                <button onClick={onClose} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1">
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
              <h3 className="font-black text-navy-700 text-lg">Check Your Phone</h3>
              <p className="text-sm text-gray-500 mt-1">An EcoCash payment request has been sent to your phone. Enter your PIN to confirm.</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for confirmation{'.'.repeat((pollCount % 3) + 1)}
            </div>
            <p className="text-xs text-gray-300">If you don&apos;t see a prompt, check your EcoCash app.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="px-6 py-10 text-center space-y-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-brand-green" />
            </div>
            <div>
              <h3 className="font-black text-navy-700 text-lg">You&apos;re All Set!</h3>
              <p className="text-sm text-gray-500 mt-1">Your subscription is active. All features are unlocked.</p>
            </div>
            <button
              onClick={() => { queryClient.invalidateQueries({ queryKey: ['subscription'] }); onClose?.(); }}
              className="w-full py-3 bg-brand-green text-white font-black rounded-xl hover:bg-green-600 transition-colors"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
