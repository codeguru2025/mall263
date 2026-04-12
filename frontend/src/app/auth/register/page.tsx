'use client';

import { Suspense, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Logo } from '@/components/Logo';
import {
  Phone, Lock, User, ArrowRight, ArrowLeft,
  ShoppingBag, Store, MapPin, CheckCircle2, Loader2, Camera,
} from 'lucide-react';

function RegisterForm() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role'); // 'buyer' | 'seller' | null
  const initialRole: 'BUYER' | 'STALL_OWNER' = roleParam === 'seller' ? 'STALL_OWNER' : 'BUYER';
  const roleLocked = roleParam === 'buyer' || roleParam === 'seller';

  const [role, setRole] = useState<'BUYER' | 'STALL_OWNER'>(initialRole);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    businessPhone: '',
    stallName: '',
    stallNumber: '',
    mallId: '',
    description: '',
  });

  const register = useAuthStore((s) => s.register);
  const router = useRouter();

  const { data: malls = [] } = useQuery({
    queryKey: ['malls'],
    queryFn: () => api.get('/api/v1/stalls/malls').then((r) => r.data),
    enabled: role === 'STALL_OWNER',
  });

  const totalSteps = role === 'STALL_OWNER' ? 3 : 1;

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/api/v1/upload/avatar', fd);
      setAvatarUrl(data.url);
    } catch {
      toast.error('Failed to upload photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  const step1Valid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    /^(\+263|0)[0-9]{9}$/.test(form.phone.trim()) &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword;

  const step2Valid = form.businessName.trim().length > 0;
  const step3Valid = form.stallName.trim().length > 0 && form.stallNumber.trim().length > 0;

  const currentStepValid = step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Advance steps for sellers
    if (step < totalSteps) {
      if (!currentStepValid) return;
      setStep((s) => (s + 1) as typeof step);
      return;
    }

    if (!currentStepValid) return;

    setLoading(true);
    try {
      await register({
        phone: form.phone,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        role,
        ...(avatarUrl ? { avatarUrl } : {}),
      } as any);

      if (role === 'STALL_OWNER') {
        await api.post('/api/v1/merchants/me/setup', {
          businessName: form.businessName,
          businessPhone: form.businessPhone || undefined,
          stallName: form.stallName,
          stallNumber: form.stallNumber,
          mallId: form.mallId || undefined,
          description: form.description || undefined,
        });
      }

      toast.success('Welcome to Mall263!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Account details', 'Business info', 'Stall setup'];

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 items-center justify-center p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, #3B9AE1 0%, transparent 50%), radial-gradient(circle at 70% 70%, #E53935 0%, transparent 50%)' }}
        />
        <div className="relative text-center w-full max-w-xs">
          <h2 className="text-4xl font-black text-white mb-4">
            Join the<br /><span className="text-brand-green">Marketplace</span>
          </h2>
          <p className="text-white/60 mb-10 text-sm">
            {role === 'STALL_OWNER'
              ? 'Set up your account and stall in 3 quick steps.'
              : 'Create your account and start buying in under a minute.'}
          </p>

          {role === 'STALL_OWNER' ? (
            <div className="text-left space-y-4">
              {stepLabels.map((label, i) => {
                const done = step > i + 1;
                const active = step === i + 1;
                return (
                  <div key={label} className={`flex items-center gap-3 text-sm transition-colors ${done ? 'text-brand-green' : active ? 'text-white' : 'text-white/30'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 transition-all ${done ? 'bg-brand-green border-brand-green text-white' : active ? 'bg-white/20 border-white text-white' : 'border-white/20 text-white/30'}`}>
                      {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className="font-semibold">{label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 text-left">
              {['Post demands & get live offers', 'Wallet-secured transactions', 'Pick the best offer & collect in person'].map((t) => (
                <div key={t} className="flex items-center gap-3 text-white/70 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-brand-green flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="min-h-full flex flex-col justify-center px-6 py-10">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-6">
              <Link href="/"><Logo size={40} /></Link>
              <h1 className="text-2xl font-black text-navy-700 mt-6">Create your account</h1>
              <p className="text-gray-500 mt-1 text-sm">
                {role === 'STALL_OWNER'
                  ? `Step ${step} of 3 — ${stepLabels[step - 1]}`
                  : 'Start buying on Mall263'}
              </p>
            </div>

            {/* Progress bar for sellers */}
            {role === 'STALL_OWNER' && (
              <div className="h-1.5 bg-gray-100 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-brand-orange rounded-full transition-all duration-300"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── Step 1: Account ── */}
              {step === 1 && (
                <>
                  {/* Role selector */}
                  {roleLocked ? (
                    <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 ${role === 'BUYER' ? 'border-brand-blue bg-blue-50' : 'border-brand-green bg-green-50'}`}>
                      {role === 'BUYER'
                        ? <ShoppingBag className="w-6 h-6 text-brand-blue flex-shrink-0" />
                        : <Store className="w-6 h-6 text-brand-green flex-shrink-0" />
                      }
                      <div>
                        <div className={`font-bold text-sm ${role === 'BUYER' ? 'text-brand-blue' : 'text-brand-green'}`}>
                          {role === 'BUYER' ? 'Buyer Account' : 'Seller Account'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {role === 'BUYER' ? 'Shop & post demands' : 'List products & use POS'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="label mb-2">I want to</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => { setRole('BUYER'); setStep(1); }}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${role === 'BUYER' ? 'border-brand-blue bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                          <ShoppingBag className={`w-6 h-6 ${role === 'BUYER' ? 'text-brand-blue' : 'text-gray-400'}`} />
                          <div className="text-center">
                            <div className={`font-bold text-sm ${role === 'BUYER' ? 'text-brand-blue' : 'text-navy-700'}`}>Buy</div>
                            <div className="text-xs text-gray-400">Shop & post demands</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRole('STALL_OWNER'); setStep(1); }}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${role === 'STALL_OWNER' ? 'border-brand-green bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                          <Store className={`w-6 h-6 ${role === 'STALL_OWNER' ? 'text-brand-green' : 'text-gray-400'}`} />
                          <div className="text-center">
                            <div className={`font-bold text-sm ${role === 'STALL_OWNER' ? 'text-brand-green' : 'text-navy-700'}`}>Sell</div>
                            <div className="text-xs text-gray-400">List products & use POS</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Avatar upload */}
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="relative">
                      <div
                        onClick={() => avatarInputRef.current?.click()}
                        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-brand-blue transition-colors overflow-hidden"
                      >
                        {avatarUploading ? (
                          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                        ) : avatarUrl ? (
                          <Image src={avatarUrl} alt="Avatar" fill className="object-cover" sizes="80px" />
                        ) : (
                          <Camera className="w-7 h-7 text-gray-400" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-blue rounded-full flex items-center justify-center shadow">
                        <Camera className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      {avatarUrl ? 'Photo uploaded' : 'Add a profile photo (optional)'}
                    </p>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">First Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" className="input pl-11 text-sm" placeholder="Tendai" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} required />
                      </div>
                    </div>
                    <div>
                      <label className="label">Last Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" className="input pl-11 text-sm" placeholder="Moyo" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} required />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="tel" className="input pl-12" placeholder="+263 77 366 5350" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
                    </div>
                  </div>

                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="password" className="input pl-12" placeholder="Min 8 characters" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} />
                    </div>
                  </div>

                  <div>
                    <label className="label">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input type="password" className="input pl-12" placeholder="Repeat password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} required />
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <p className="text-xs text-brand-red mt-1">Passwords do not match</p>
                    )}
                  </div>
                </>
              )}

              {/* ── Step 2: Business Info (sellers only) ── */}
              {step === 2 && role === 'STALL_OWNER' && (
                <>
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border-2 border-brand-green/30">
                    <Store className="w-6 h-6 text-brand-green flex-shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-navy-700">Your Business</div>
                      <div className="text-xs text-gray-500">Tell us about your business</div>
                    </div>
                  </div>

                  <div>
                    <label className="label">Business Name <span className="text-brand-red">*</span></label>
                    <input
                      className="input"
                      placeholder="e.g. Moyo Fashion & Accessories"
                      value={form.businessName}
                      onChange={(e) => update('businessName', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Business Phone <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        className="input pl-12"
                        placeholder="+263 77 ..."
                        value={form.businessPhone}
                        onChange={(e) => update('businessPhone', e.target.value)}
                      />
                    </div>
                  </div>

                </>
              )}

              {/* ── Step 3: Stall Info (sellers only) ── */}
              {step === 3 && role === 'STALL_OWNER' && (
                <>
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border-2 border-brand-blue/30">
                    <MapPin className="w-6 h-6 text-brand-blue flex-shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-navy-700">Your Stall</div>
                      <div className="text-xs text-gray-500">Where are you located in the market?</div>
                    </div>
                  </div>

                  <div>
                    <label className="label">Stall Name <span className="text-brand-red">*</span></label>
                    <input
                      className="input"
                      placeholder="e.g. Moyo Fashion"
                      value={form.stallName}
                      onChange={(e) => update('stallName', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Stall Number <span className="text-brand-red">*</span></label>
                    <input
                      className="input"
                      placeholder="e.g. A12 or 204"
                      value={form.stallNumber}
                      onChange={(e) => update('stallNumber', e.target.value)}
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">The number or code on your stall door</p>
                  </div>

                  <div>
                    <label className="label">Market / Mall <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                    <select
                      className="input"
                      value={form.mallId}
                      onChange={(e) => update('mallId', e.target.value)}
                    >
                      <option value="">Select a market</option>
                      {(malls as any[]).map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name} — {m.city}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">What do you sell? <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                    <textarea
                      className="input min-h-[80px] resize-none"
                      placeholder="e.g. Ladies fashion, shoes and accessories"
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-1">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s - 1) as typeof step)}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border-2 border-gray-100 text-navy-700 font-bold hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !currentStepValid}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Creating...</>
                  ) : step < totalSteps ? (
                    <>Next <ArrowRight className="w-5 h-5" /></>
                  ) : (
                    <><CheckCircle2 className="w-5 h-5" /> {role === 'STALL_OWNER' ? 'Create Account & Stall' : 'Get Started'}</>
                  )}
                </button>
              </div>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-brand-orange font-bold hover:underline">Sign in</Link>
              </p>
              <div className="pb-safe" />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
