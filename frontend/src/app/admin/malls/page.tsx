'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import {
  ArrowLeft, Plus, Edit2, MapPin, Building2,
  ToggleLeft, ToggleRight, X, Check, Store,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS'];

const EMPTY_FORM = {
  name: '',
  city: '',
  address: '',
  latitude: '',
  longitude: '',
  imageUrl: '',
};

export default function AdminMallsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const isAdmin = isAuthenticated && user && ADMIN_ROLES.includes(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.push('/admin');
  }, [authLoading, isAuthenticated, user, router]);

  const [showModal, setShowModal] = useState(false);
  const [editingMall, setEditingMall] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: malls = [], isLoading } = useQuery<any[]>({
    queryKey: ['admin-malls'],
    queryFn: () => api.get('/api/v1/stalls/admin/malls').then((r) => r.data),
    enabled: !!isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/stalls/admin/malls', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Mall created successfully');
      invalidate();
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create mall'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/api/v1/stalls/admin/malls/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Mall updated');
      invalidate();
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update mall'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/stalls/admin/malls/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Mall status updated');
      invalidate();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update status'),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin-malls'] });
    // Also bust the public malls cache so dropdowns/filters refresh
    queryClient.invalidateQueries({ queryKey: ['malls'] });
  }

  function openCreate() {
    setEditingMall(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(mall: any) {
    setEditingMall(mall);
    setForm({
      name: mall.name,
      city: mall.city?.name ?? mall.city ?? '',
      address: mall.address,
      latitude: mall.latitude?.toString() || '',
      longitude: mall.longitude?.toString() || '',
      imageUrl: mall.imageUrl || '',
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingMall(null);
    setForm(EMPTY_FORM);
  }

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim() || !form.address.trim()) {
      toast.error('Name, city, and address are required');
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
    };
    if (form.latitude) payload.latitude = parseFloat(form.latitude);
    if (form.longitude) payload.longitude = parseFloat(form.longitude);
    if (form.imageUrl.trim()) payload.imageUrl = form.imageUrl.trim();

    if (editingMall) {
      updateMutation.mutate({ id: editingMall.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (authLoading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-navy-700" />
            </Link>
            <Logo size={28} />
            <div>
              <h1 className="text-lg font-black text-navy-700">Manage Malls</h1>
              <p className="text-xs text-gray-500">Add and manage market locations</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-brand-green text-white text-sm font-bold py-2.5 px-4 rounded-xl hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Mall
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 text-center">
            <p className="text-2xl font-black text-navy-700">{malls.length}</p>
            <p className="text-xs text-gray-500 mt-1">Total Malls</p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-green-100 p-4 text-center">
            <p className="text-2xl font-black text-brand-green">
              {malls.filter((m) => m.isActive).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Active</p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 text-center">
            <p className="text-2xl font-black text-navy-700">
              {malls.reduce((sum: number, m: any) => sum + (m._count?.stalls || 0), 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total Stalls</p>
          </div>
        </div>

        {/* Mall list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border border-gray-100 h-24" />
            ))}
          </div>
        ) : malls.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="font-black text-navy-700 text-lg mb-1">No malls yet</p>
            <p className="text-sm text-gray-500 mb-4">Add your first mall so sellers can register stalls.</p>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" /> Add First Mall
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {malls.map((mall: any) => (
              <div
                key={mall.id}
                className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                  mall.isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${mall.isActive ? 'bg-green-50' : 'bg-gray-100'}`}>
                    <Building2 className={`w-6 h-6 ${mall.isActive ? 'text-brand-green' : 'text-gray-400'}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-navy-700">{mall.name}</span>
                      {!mall.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" />
                      <span className="truncate">{mall.city?.name ?? mall.city} · {mall.address}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <Store className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-400 font-semibold">
                        {mall._count?.stalls ?? 0} stall{mall._count?.stalls !== 1 ? 's' : ''} registered
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(mall)}
                      className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                      title="Edit mall"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate({ id: mall.id, isActive: !mall.isActive })}
                      disabled={toggleMutation.isPending}
                      className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                      title={mall.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {mall.isActive
                        ? <ToggleRight className="w-6 h-6 text-brand-green" />
                        : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-navy-700">
                {editingMall ? 'Edit Mall' : 'Add New Mall'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="label">Mall / Market Name <span className="text-brand-red">*</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Mbare Musika, Sam Levy's Village"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">City <span className="text-brand-red">*</span></label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Harare"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Address <span className="text-brand-red">*</span></label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Mbare, Harare"
                    value={form.address}
                    onChange={(e) => update('address', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Latitude <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="-17.8216"
                    value={form.latitude}
                    onChange={(e) => update('latitude', e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Longitude <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="31.0492"
                    value={form.longitude}
                    onChange={(e) => update('longitude', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Image URL <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={(e) => update('imageUrl', e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2 pb-safe">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3.5 rounded-2xl border-2 border-gray-100 text-navy-700 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  {editingMall ? 'Save Changes' : 'Create Mall'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
