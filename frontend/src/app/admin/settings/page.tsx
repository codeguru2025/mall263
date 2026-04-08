'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Settings, Truck, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const [deliveryRate, setDeliveryRate] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS'].includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/api/v1/admin/settings').then((r) => r.data),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (settings?.delivery_rate_per_km !== undefined) {
      setDeliveryRate(settings.delivery_rate_per_km);
    }
  }, [settings]);

  const saveSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.post(`/api/v1/admin/settings/${key}`, { value }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Setting saved');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={28} />
          <div>
            <h1 className="text-lg font-black text-navy-700">App Settings</h1>
            <p className="text-xs text-gray-400">Platform configuration</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        ) : (
          <>
            {/* Delivery settings */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <Truck className="w-5 h-5 text-brand-orange" />
                </div>
                <div>
                  <h2 className="font-black text-navy-700">Delivery Pricing</h2>
                  <p className="text-xs text-gray-500">Set the per-kilometre delivery charge</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label">Rate per Kilometre (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input pl-9 text-lg font-black"
                      placeholder="0.50"
                      value={deliveryRate}
                      onChange={(e) => setDeliveryRate(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    The app will calculate distance from stall to buyer and charge this rate per km.
                    e.g. 5km × $0.50/km = $2.50 delivery fee.
                  </p>
                </div>
                <button
                  onClick={() => {
                    const val = parseFloat(deliveryRate);
                    if (isNaN(val) || val < 0) { toast.error('Enter a valid rate'); return; }
                    saveSetting.mutate({ key: 'delivery_rate_per_km', value: val.toFixed(2) });
                  }}
                  disabled={saveSetting.isPending}
                  className="btn-primary flex items-center gap-2"
                >
                  {saveSetting.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    : <><Save className="w-4 h-4" /> Save Rate</>}
                </button>
              </div>
            </div>

            {/* Current settings summary */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-500">Current Values</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Delivery rate</span>
                  <span className="font-bold text-navy-700">${settings?.delivery_rate_per_km ?? '0.50'} / km</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
