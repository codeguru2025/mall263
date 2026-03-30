'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Store, XCircle, Loader2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminStallsPage() {
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
    queryKey: ['admin-stalls'],
    queryFn: () => api.get('/api/v1/merchants', { params: { limit: 50 } }).then((r) => r.data).catch(() => ({ data: [] })),
    enabled: isAuthenticated,
  });

  const suspend = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/admin/stalls/${id}/suspend`).then((r) => r.data),
    onSuccess: () => { toast.success('Stall suspended'); queryClient.invalidateQueries({ queryKey: ['admin-stalls'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  // Flatten merchants → stalls
  const stalls = (data?.data || []).flatMap((m: any) =>
    (m.stalls || []).map((s: any) => ({ ...s, merchantName: m.businessName }))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Manage Stalls</h1>
            <p className="text-xs text-gray-500">Suspend market stalls</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
            </div>
          ) : stalls.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No stalls found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {stalls.map((s: any) => (
                <div key={s.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-brand-orange" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-navy-700 text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500">Stall {s.stallNumber} · {s.merchantName}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    s.status === 'ACTIVE' ? 'bg-green-50 text-brand-green' : 'bg-red-50 text-brand-red'
                  }`}>
                    {s.status}
                  </span>
                  {s.status === 'ACTIVE' && (
                    <button
                      onClick={() => suspend.mutate(s.id)}
                      disabled={suspend.isPending}
                      className="p-2 rounded-xl hover:bg-red-50 text-brand-red transition-colors"
                      title="Suspend"
                    >
                      <XCircle className="w-5 h-5" />
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
