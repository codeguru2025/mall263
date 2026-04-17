'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { Logo } from '@/components/Logo';
import { Phone, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(phone.trim(), password);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, #F7941D 0%, transparent 50%), radial-gradient(circle at 70% 70%, #43A047 0%, transparent 50%)' }} />
        <div className="relative text-center">
          <h2 className="text-4xl font-black text-white mb-4">Find it. Bid on it.<br /><span className="text-brand-orange">Get it.</span></h2>
          <p className="text-white/60 max-w-sm mx-auto">Post what you need. Sellers compete. You pick the best deal.</p>
          <div className="mt-8 flex items-center justify-center gap-6 text-white/40 text-sm">
            <div className="text-center"><div className="text-2xl font-black text-brand-orange">2,500+</div>Sellers</div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center"><div className="text-2xl font-black text-brand-green">15K+</div>Products</div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center"><div className="text-2xl font-black text-brand-blue">8K+</div>Demands</div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="min-h-full flex flex-col justify-center px-6 py-10">
        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <Link href="/"><Logo size={40} /></Link>
            <h1 className="text-2xl font-black text-navy-700 mt-6">Welcome back</h1>
            <p className="text-gray-500 mt-1">Sign in to continue to Mall263</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Phone number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="tel" className="input pl-12" placeholder="+263771234567" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <p className="text-xs text-gray-500 mt-1">Include country code (10–15 digits after +).</p>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="password" className="input pl-12" placeholder="Your account password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <p className="text-xs text-gray-500 mt-1">Use the same password you chose when you registered for this number.</p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing in...</>
              ) : (
                <>Sign In <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
            <p className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="text-brand-orange font-bold hover:underline">Sign up</Link>
            </p>
            <div className="pb-safe" />
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
