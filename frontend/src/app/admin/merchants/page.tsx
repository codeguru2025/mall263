'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Store, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminMerchantsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'].includes(user.role)) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-merchants'],
    queryFn: () => api.get('/api/v1/merchants', { params: { limit: 50 } }).then((r) => r.data),
    enabled: isAuthenticated,
  });

  const verify = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/merchants/${id}/verify`).then((r) => r.data),
    onSuccess: () => { toast.success('Merchant verified'); queryClient.invalidateQueries({ queryKey: ['admin-merchants'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const merchants = data?.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Manage Merchants</h1>
            <p className="text-xs text-gray-500">Verify merchant accounts</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
            </div>
          ) : merchants.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No merchants found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {merchants.map((m: any) => (
                <div key={m.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Store className="w-5 h-5 text-brand-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-navy-700 text-sm">{m.businessName}</div>
                    <div className="text-xs text-gray-500">{m.user?.firstName} {m.user?.lastName} · {m.user?.phone}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{m.stalls?.length ?? 0} stall(s)</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    m.status === 'VERIFIED' ? 'bg-green-50 text-brand-green'
                    : m.status === 'PENDING' ? 'bg-orange-50 text-brand-orange'
                    : 'bg-red-50 text-brand-red'
                  }`}>
                    {m.status}
                  </span>
                  {m.status === 'PENDING' && (
                    <button
                      onClick={() => verify.mutate(m.id)}
                      disabled={verify.isPending}
                      className="flex items-center gap-1.5 text-sm font-bold text-brand-green bg-green-50 hover:bg-green-100 transition-colors px-3 py-2 rounded-xl"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Verify
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
