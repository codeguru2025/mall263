'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Users, ArrowLeft, Search, Plus, X, Phone, Lock, User, Shield, ChevronRight, Ban, CheckCircle } from 'lucide-react';
import { Logo } from '@/components/Logo';
import toast from 'react-hot-toast';

type UserRole = 'BUYER' | 'STALL_OWNER' | 'ATTENDANT' | 'FIELD_AGENT' | 'ADMIN_OPS' | 'FINANCE_ADMIN' | 'SUPER_ADMIN';

interface CreateUserForm {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  role: UserRole;
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'];

export default function AdminUsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUserForm>({
    firstName: '',
    lastName: '',
    phone: '',
    password: '',
    role: 'BUYER',
  });

  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const isAdmin = isAuthenticated && user && ADMIN_ROLES.includes(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.push('/dashboard');
  }, [authLoading, isAuthenticated, user, router]);

  if (authLoading || !isAdmin) return null;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, page],
    queryFn: () => api.get('/api/v1/admin/users', { params: { search, page, limit: 20 } }).then((r) => r.data),
    enabled: !!isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserForm) => api.post('/api/v1/admin/users', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setForm({ firstName: '', lastName: '', phone: '', password: '', role: 'BUYER' });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create user'),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      api.patch(`/api/v1/admin/users/${id}/${suspend ? 'suspend' : 'activate'}`).then((r) => r.data),
    onSuccess: () => {
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setActiveUserId(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Action failed'),
    onSettled: () => setActiveUserId(null),
  });

  const update = (field: keyof CreateUserForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.phone || !form.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate(form);
  };

  const roleColors: Record<string, string> = {
    BUYER: 'bg-blue-50 text-brand-blue',
    STALL_OWNER: 'bg-green-50 text-brand-green',
    ATTENDANT: 'bg-orange-50 text-brand-orange',
    FIELD_AGENT: 'bg-purple-50 text-purple-600',
    ADMIN_OPS: 'bg-red-50 text-brand-red',
    FINANCE_ADMIN: 'bg-yellow-50 text-yellow-700',
    SUPER_ADMIN: 'bg-navy-50 text-navy-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-5 h-5 text-navy-600" />
            </Link>
            <Logo size={28} />
            <div>
              <h1 className="text-lg font-black text-navy-700">Manage Users</h1>
              <p className="text-xs text-gray-500">{data?.total || 0} total users</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm py-2.5 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create User
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-5">
        {/* Search */}
        <div className="bg-white rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-blue mb-5 transition-all">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full py-3 bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none"
          />
        </div>

        {/* User list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-gray-50 animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-full" />
                <div className="flex-1"><div className="bg-gray-100 h-4 rounded w-1/3 mb-2" /><div className="bg-gray-100 h-3 rounded w-1/4" /></div>
              </div>
            ))
          ) : (data?.data || []).length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(data?.data || []).map((user: any) => (
                <div key={user.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-blue to-brand-green rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-navy-700 truncate">{user.firstName} {user.lastName}</div>
                    <div className="text-xs text-gray-500">{user.phone}</div>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${roleColors[user.role] || 'bg-gray-100 text-gray-600'}`}>
                    {user.role.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => { setActiveUserId(user.id); suspendMutation.mutate({ id: user.id, suspend: user.status === 'ACTIVE' }); }}
                    disabled={suspendMutation.isPending && activeUserId === user.id}
                    className={`flex-shrink-0 p-2 rounded-xl transition-colors ${user.status === 'SUSPENDED' ? 'hover:bg-green-50 text-brand-green' : 'hover:bg-red-50 text-brand-red'}`}
                    title={user.status === 'SUSPENDED' ? 'Activate user' : 'Suspend user'}
                  >
                    {user.status === 'SUSPENDED' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {(data?.total || 0) > 20 && (
          <div className="flex justify-center mt-6 gap-3">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40">Previous</button>
            <span className="py-2.5 px-4 text-sm font-bold text-navy-700 bg-white rounded-xl border-2 border-gray-100">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= (data?.total || 0)} className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {/* Create User Modal — keyboard-safe with overflow-y-auto */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreate(false)} />

          {/* Sheet — scrollable so keyboard never covers the button */}
          <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-90dvh flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-black text-navy-700">Create New User</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="overflow-y-auto flex-1">
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">First Name <span className="text-brand-red">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" className="input pl-10 text-sm" placeholder="John" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} required />
                    </div>
                  </div>
                  <div>
                    <label className="label">Last Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" className="input pl-10 text-sm" placeholder="Doe" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">Phone Number <span className="text-brand-red">*</span></label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="tel" className="input pl-11" placeholder="+263 77 123 4567" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
                  </div>
                </div>

                <div>
                  <label className="label">Password <span className="text-brand-red">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="password" className="input pl-11" placeholder="Min 8 characters" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} />
                  </div>
                </div>

                <div>
                  <label className="label">Role <span className="text-brand-red">*</span></label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select className="input pl-11 appearance-none" value={form.role} onChange={(e) => update('role', e.target.value)}>
                      <option value="BUYER">Buyer</option>
                      <option value="STALL_OWNER">Stall Owner</option>
                      <option value="ATTENDANT">Attendant</option>
                      <option value="FIELD_AGENT">Field Agent</option>
                      <option value="ADMIN_OPS">Admin Ops</option>
                      <option value="FINANCE_ADMIN">Finance Admin</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </div>
                </div>

                {/* Footer pinned inside the scroll so it's always reachable */}
                <div className="pt-2 pb-safe">
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {createMutation.isPending ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating...</>
                    ) : (
                      <><Plus className="w-5 h-5" /> Create User</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
