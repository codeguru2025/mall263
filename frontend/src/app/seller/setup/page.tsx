'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { Store, MapPin, ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 1 | 2;

export default function SellerSetupPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [step, setStep] = useState<Step>(1);

  const [form, setForm] = useState({
    businessName: '',
    businessPhone: '',
    stallName: '',
    stallNumber: '',
    mallId: '',
    address: '',
    description: '',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
    if (user?.role === 'FIELD_AGENT') {
      router.replace('/agent');
      return;
    }
    if (user && !['STALL_OWNER', 'ATTENDANT'].includes(user.role)) {
      router.push('/dashboard');
      return;
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Pre-fill business name from user's name
  useEffect(() => {
    if (user) {
      setForm((f) => {
        if (f.businessName) return f;
        return { ...f, businessName: `${user.firstName} ${user.lastName}` };
      });
    }
  }, [user]);

  const { data: malls } = useQuery({
    queryKey: ['malls'],
    queryFn: () => api.get('/api/v1/stalls/malls').then((r) => r.data),
  });

  const setupMutation = useMutation({
    mutationFn: () => api.post('/api/v1/merchants/me/setup', {
      businessName: form.businessName,
      businessPhone: form.businessPhone || undefined,
      stallName: form.stallName,
      stallNumber: form.stallNumber,
      mallId: form.mallId || undefined,
      address: form.address || undefined,
      description: form.description || undefined,
    }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Stall created! Welcome to Mall263.');
      router.push('/dashboard');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Setup failed'),
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const step1Valid = form.businessName.trim().length > 0;
  const step2Valid = form.stallName.trim().length > 0 && form.stallNumber.trim().length > 0;

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Set Up Your Stall</h1>
            <p className="text-xs text-gray-500">Step {step} of 2</p>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-1 bg-brand-orange transition-all duration-300"
          style={{ width: step === 1 ? '50%' : '100%' }}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 pt-8 pb-28 sm:pb-8">

        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Store className="w-7 h-7 text-brand-green" />
              </div>
              <h2 className="text-xl font-black text-navy-700">Your Business</h2>
              <p className="text-sm text-gray-500 mt-1">Tell us about your business</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div>
                <label className="label">Business Name <span className="text-brand-red">*</span></label>
                <input
                  className="input"
                  placeholder="e.g. Moyo Fashion & Accessories"
                  value={form.businessName}
                  onChange={(e) => update('businessName', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Business Phone</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="+263 77 ..."
                  value={form.businessPhone}
                  onChange={(e) => update('businessPhone', e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="btn-primary w-full flex items-center justify-center gap-2 py-4"
            >
              Next <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-7 h-7 text-brand-blue" />
              </div>
              <h2 className="text-xl font-black text-navy-700">Your {form.mallId ? 'Stall' : 'Shop'}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {form.mallId ? 'Where are you located in the market?' : 'Tell us about your shop location'}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div>
                <label className="label">Market / Mall</label>
                <select
                  className="input"
                  value={form.mallId}
                  onChange={(e) => update('mallId', e.target.value)}
                >
                  <option value="">I have my own shop (not in a mall)</option>
                  {(malls || []).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name} — {m.city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{form.mallId ? 'Stall' : 'Shop'} Name <span className="text-brand-red">*</span></label>
                <input
                  className="input"
                  placeholder={form.mallId ? 'e.g. Moyo Fashion' : 'e.g. Moyo Fashion & Accessories'}
                  value={form.stallName}
                  onChange={(e) => update('stallName', e.target.value)}
                />
              </div>
              <div>
                <label className="label">{form.mallId ? 'Stall Number' : 'Shop / Unit Number'} <span className="text-brand-red">*</span></label>
                <input
                  className="input"
                  placeholder={form.mallId ? 'e.g. A12 or 204' : 'e.g. Shop 5 or Unit 12B'}
                  value={form.stallNumber}
                  onChange={(e) => update('stallNumber', e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {form.mallId ? 'The number or code on your stall door' : 'Your shop or unit number'}
                </p>
              </div>
              {!form.mallId && (
                <div>
                  <label className="label">Street Address</label>
                  <input
                    className="input"
                    placeholder="e.g. 15 First Ave, Bulawayo CBD"
                    value={form.address}
                    onChange={(e) => update('address', e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Helps buyers find you — e.g. street, area, or landmark</p>
                </div>
              )}
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  placeholder="What do you sell? e.g. Ladies fashion, shoes and accessories"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-5 py-4 rounded-2xl border-2 border-gray-100 text-navy-700 font-bold hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => setupMutation.mutate()}
                disabled={!step2Valid || setupMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-4"
              >
                {setupMutation.isPending
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Setting up...</>
                  : <><CheckCircle2 className="w-5 h-5" /> Create My Stall</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
