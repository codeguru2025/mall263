'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Plus, Edit2, Trash2, Tag, ToggleLeft, ToggleRight, Image as ImageIcon, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'];

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', parentId: '', imageUrl: '' });
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

  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/api/v1/admin/categories').then((r) => r.data),
    enabled: !!isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; parentId?: string; imageUrl?: string }) =>
      api.post('/api/v1/admin/categories', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Category created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/api/v1/admin/categories/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Category updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/categories/${id}`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Category deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete category'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/admin/categories/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Category status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update status'),
  });

  if (authLoading || !isAdmin) return null;

  const openModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        parentId: category.parentId || '',
        imageUrl: category.imageUrl || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', parentId: '', imageUrl: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', parentId: '', imageUrl: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    const data = {
      name: formData.name.trim(),
      parentId: formData.parentId || undefined,
      imageUrl: formData.imageUrl || undefined,
    };

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const parentCategories = categories?.filter((c: any) => !c.parentId) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-navy-700" />
            </Link>
            <Logo size={30} />
            <div>
              <h1 className="text-lg font-black text-navy-700">Category Management</h1>
              <p className="text-xs text-gray-500">Manage product categories</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-brand-green text-white text-sm font-bold py-2.5 px-4 rounded-xl hover:bg-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100 h-20" />
            ))}
          </div>
        ) : !categories || categories.length === 0 ? (
          <div className="text-center py-16">
            <Tag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No categories yet</p>
            <button
              onClick={() => openModal()}
              className="mt-3 inline-flex items-center gap-2 text-brand-green font-bold text-sm hover:underline"
            >
              <Plus className="w-4 h-4" /> Add your first category
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((category: any) => (
              <div key={category.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${category.isActive ? 'bg-green-50' : 'bg-gray-100'}`}>
                      <Tag className={`w-5 h-5 ${category.isActive ? 'text-brand-green' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-navy-700">{category.name}</span>
                        {category.parent && (
                          <span className="text-xs bg-blue-50 text-brand-blue px-2 py-0.5 rounded-full font-medium">
                            Child of: {category.parent.name}
                          </span>
                        )}
                        {!category.isActive && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500">
                          {category._count?.products || 0} product{category._count?.products !== 1 ? 's' : ''}
                        </p>
                        {category.children?.length > 0 && (
                          <p className="text-xs text-gray-500">
                            {category.children.length} subcategor{category.children.length !== 1 ? 'ies' : 'y'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openModal(category)}
                      className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                      title="Edit category"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => toggleActiveMutation.mutate({ id: category.id, isActive: !category.isActive })}
                      className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                      title={category.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {category.isActive ? (
                        <ToggleRight className="w-5 h-5 text-brand-green" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(category.id, category.name)}
                      className="p-2 rounded-xl hover:bg-red-50 transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-brand-red" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-black text-navy-700 mb-4">
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">
                  Category Name <span className="text-brand-red">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Electronics, Clothing, Food"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Parent Category (Optional)</label>
                <select
                  className="input"
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                >
                  <option value="">None (Top-level category)</option>
                  {parentCategories
                    .filter((c: any) => !editingCategory || c.id !== editingCategory.id)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select a parent to create a subcategory
                </p>
              </div>

              <div>
                <label className="label">Category Image <span className="text-gray-400 font-normal text-xs">(Optional)</span></label>
                <CatImageField value={formData.imageUrl} onChange={(url) => setFormData({ ...formData, imageUrl: url })} />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 px-4 border-2 border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 px-4 bg-brand-green text-white rounded-xl font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingCategory
                    ? 'Update'
                    : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CatImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/api/v1/upload/image', fd);
      onChange(data.cdnUrl || data.url);
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }
  return (
    <div className="space-y-2">
      {value && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-16 w-16 rounded-xl object-cover border-2 border-gray-100" />
          <button type="button" onClick={() => onChange('')} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <label className={`flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-sm font-semibold ${uploading ? 'border-gray-200 text-gray-300' : 'border-gray-200 text-gray-500 hover:border-brand-green hover:text-brand-green'}`}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        {uploading ? 'Uploading…' : value ? 'Change image' : 'Upload image'}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  );
}
