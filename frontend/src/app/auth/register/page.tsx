'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { Logo } from '@/components/Logo';
import { Phone, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await register({ phone: form.phone, password: form.password, firstName: form.firstName, lastName: form.lastName });
      toast.success('Account created!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, #3B9AE1 0%, transparent 50%), radial-gradient(circle at 70% 70%, #E53935 0%, transparent 50%)' }} />
        <div className="relative text-center">
          <h2 className="text-4xl font-black text-white mb-4">Join the<br /><span className="text-brand-green">Marketplace</span></h2>
          <p className="text-white/60 max-w-sm mx-auto mb-8">Create your account and start buying or selling in under 60 seconds.</p>
          <div className="space-y-3 text-left max-w-xs mx-auto">
            {['Post demands & get live offers', 'Wallet-secured transactions', 'Free POS system for sellers'].map((t) => (
              <div key={t} className="flex items-center gap-3 text-white/70 text-sm">
                <ShieldCheck className="w-5 h-5 text-brand-green flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <Link href="/"><Logo size={40} /></Link>
            <h1 className="text-2xl font-black text-navy-700 mt-6">Create your account</h1>
            <p className="text-gray-500 mt-1">Start buying or selling on Mall263</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</>
              ) : (
                <>Get Started <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-brand-orange font-bold hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
