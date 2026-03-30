'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Users, Search, CheckCircle2, XCircle, Loader2, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = ['BUYER', 'STALL_OWNER', 'ATTENDANT', 'FIELD_AGENT', 'ADMIN_OPS', 'FINANCE_ADMIN', 'SUPER_ADMIN'];

export default function AdminUsersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'].includes(user.role)) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => api.get('/api/v1/admin/users', { params: { search, limit: 50 } }).then((r) => r.data).catch(() => ({ data: [] })),
    enabled: isAuthenticated,
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/api/v1/admin/users/${id}/role`, { role }).then((r) => r.data),
    onSuccess: () => { toast.success('Role updated'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/admin/users/${id}/suspend`).then((r) => r.data),
    onSuccess: () => { toast.success('User suspended'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/admin/users/${id}/activate`).then((r) => r.data),
    onSuccess: () => { toast.success('User activated'); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const users = data?.data || data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Manage Users</h1>
            <p className="text-xs text-gray-500">Suspend or activate accounts</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden mb-4">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="flex-1 outline-none text-sm text-navy-700 placeholder-gray-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map((u: any) => (
                <div key={u.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-blue to-brand-green rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-navy-700 text-sm">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-gray-500">{u.phone} · <span className="capitalize">{u.role?.replace(/_/g, ' ').toLowerCase()}</span></div>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                    className="text-xs font-bold border-2 border-gray-100 rounded-lg px-2 py-1 bg-white text-navy-700 focus:border-brand-blue outline-none"
                    title="Change role"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                  </select>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${u.status !== 'SUSPENDED' ? 'bg-green-50 text-brand-green' : 'bg-red-50 text-brand-red'}`}>
                    {u.status !== 'SUSPENDED' ? 'Active' : 'Suspended'}
                  </span>
                  {u.status !== 'SUSPENDED' ? (
                    <button
                      onClick={() => suspend.mutate(u.id)}
                      disabled={suspend.isPending}
                      className="p-2 rounded-xl hover:bg-red-50 text-brand-red transition-colors"
                      title="Suspend"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => activate.mutate(u.id)}
                      disabled={activate.isPending}
                      className="p-2 rounded-xl hover:bg-green-50 text-brand-green transition-colors"
                      title="Activate"
                    >
                      <CheckCircle2 className="w-5 h-5" />
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
