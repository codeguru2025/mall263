'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import {
  ArrowLeft, Plus, Trash2, Loader2, Image as ImageIcon,
  ToggleLeft, ToggleRight, X, Eye, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Placement = 'BANNER_TOP' | 'BANNER_BOTTOM' | 'SIDEBAR' | 'INTERSTITIAL';

interface Ad {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  placement: Placement;
  targetRole: string | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  impressions: number;
}

const PLACEMENT_LABELS: Record<Placement, string> = {
  BANNER_TOP: 'Top Banner',
  BANNER_BOTTOM: 'Bottom Banner',
  SIDEBAR: 'Sidebar',
  INTERSTITIAL: 'Interstitial',
};

const PLACEMENT_COLORS: Record<Placement, string> = {
  BANNER_TOP: 'bg-blue-50 text-blue-700',
  BANNER_BOTTOM: 'bg-teal-50 text-teal-700',
  SIDEBAR: 'bg-purple-50 text-purple-700',
  INTERSTITIAL: 'bg-orange-50 text-brand-orange',
};

const TODAY = new Date().toISOString().slice(0, 10);

const BLANK = {
  title: '',
  imageUrl: '',
  linkUrl: '',
  placement: 'BANNER_TOP' as Placement,
  targetRole: '',
  startsAt: TODAY,
  endsAt: '',
};

export default function AdsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS'].includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  const { data: ads = [], isLoading } = useQuery<Ad[]>({
    queryKey: ['admin-ads'],
    queryFn: () => api.get('/api/v1/admin/ads').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      editingId
        ? api.patch(`/api/v1/admin/ads/${editingId}`, payload).then((r) => r.data)
        : api.post('/api/v1/admin/ads', payload).then((r) => r.data),
    onSuccess: () => {
      toast.success(editingId ? 'Ad updated' : 'Ad created');
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
      closeForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Save failed'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/admin/ads/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ads'] }),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/ads/${id}`),
    onSuccess: () => {
      toast.success('Ad deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const openCreate = () => { setForm(BLANK); setEditingId(null); setShowForm(true); };
  const openEdit = (ad: Ad) => {
    setForm({
      title: ad.title,
      imageUrl: ad.imageUrl ?? '',
      linkUrl: ad.linkUrl ?? '',
      placement: ad.placement,
      targetRole: ad.targetRole ?? '',
      startsAt: ad.startsAt.slice(0, 10),
      endsAt: ad.endsAt ? ad.endsAt.slice(0, 10) : '',
    });
    setEditingId(ad.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.startsAt) { toast.error('Start date is required'); return; }
    saveMutation.mutate({
      title: form.title.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      linkUrl: form.linkUrl.trim() || undefined,
      placement: form.placement,
      targetRole: form.targetRole || undefined,
      startsAt: form.startsAt,
      endsAt: form.endsAt || undefined,
    });
  };

  const isExpired = (ad: Ad) => ad.endsAt && new Date(ad.endsAt) < new Date();
  const isScheduled = (ad: Ad) => new Date(ad.startsAt) > new Date();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex-shrink-0"><Logo size={28} /></Link>
            <div>
              <h1 className="text-base font-black text-navy-700">Ads & Promotions</h1>
              <p className="text-xs text-gray-500">Manage banners, interstitials, and sidebar ads</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy-700">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 bg-navy-700 text-white text-xs font-bold rounded-xl hover:bg-navy-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Ad
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : ads.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="font-bold">No ads yet</p>
            <p className="text-sm mt-1">Create your first banner or ad placement.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ads.map((ad) => {
              const expired = isExpired(ad);
              const scheduled = isScheduled(ad);
              return (
                <div key={ad.id} className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${ad.isActive && !expired ? 'border-gray-100' : 'border-gray-100 opacity-70'}`}>
                  {ad.imageUrl ? (
                    <div className="h-36 bg-gray-100 relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-36 bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-gray-300" />
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-black text-navy-700 text-sm leading-snug">{ad.title}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${PLACEMENT_COLORS[ad.placement]}`}>
                        {PLACEMENT_LABELS[ad.placement]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <Eye className="w-3 h-3" />
                      <span>{ad.impressions.toLocaleString()} impressions</span>
                      {expired && <span className="bg-red-50 text-red-500 font-bold px-1.5 py-0.5 rounded">Expired</span>}
                      {scheduled && !expired && <span className="bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded">Scheduled</span>}
                    </div>

                    {ad.targetRole && (
                      <p className="text-xs text-gray-400 mb-2">Target: {ad.targetRole}</p>
                    )}

                    <p className="text-xs text-gray-400 mb-3">
                      {new Date(ad.startsAt).toLocaleDateString()}
                      {ad.endsAt && ` → ${new Date(ad.endsAt).toLocaleDateString()}`}
                    </p>

                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => toggleMutation.mutate({ id: ad.id, isActive: !ad.isActive })}
                        title={ad.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {ad.isActive
                          ? <ToggleRight className="w-5 h-5 text-brand-green" />
                          : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                      </button>
                      {ad.linkUrl && (
                        <a href={ad.linkUrl} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-navy-700 hover:bg-gray-50 rounded-lg transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => openEdit(ad)}
                          className="text-xs text-gray-400 hover:text-navy-700 font-semibold px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete ad "${ad.title}"?`)) deleteMutation.mutate(ad.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-black text-navy-700">{editingId ? 'Edit Ad' : 'New Ad'}</h2>
              <button onClick={closeForm}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Summer Sale — Up to 30% off"
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Placement</label>
                <select
                  value={form.placement}
                  onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value as Placement }))}
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
                >
                  {(Object.keys(PLACEMENT_LABELS) as Placement[]).map((p) => (
                    <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Ad Image (optional)</label>
                <AdminImageField
                  value={form.imageUrl}
                  onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Link URL (optional)</label>
                <input
                  value={form.linkUrl}
                  onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                  placeholder="https://…"
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 focus:border-brand-green outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Target Role (optional)</label>
                <select
                  value={form.targetRole}
                  onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}
                  className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 font-semibold focus:border-brand-green outline-none"
                >
                  <option value="">All users</option>
                  <option value="BUYER">Buyers only</option>
                  <option value="STALL_OWNER">Stall owners only</option>
                  <option value="ATTENDANT">Attendants only</option>
                  <option value="FIELD_AGENT">Field agents only</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Starts *</label>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 focus:border-brand-green outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Ends (optional)</label>
                  <input
                    type="date"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    className="w-full border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm text-navy-700 focus:border-brand-green outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 pb-6 pt-4 border-t border-gray-100 flex gap-3">
              <button onClick={closeForm} className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                className="flex-1 py-3 bg-navy-700 text-white font-black rounded-xl hover:bg-navy-800 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Ad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/api/v1/upload/image', form);
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
          <img src={value} alt="" className="h-20 rounded-xl object-cover border-2 border-gray-100" />
          <button type="button" onClick={() => onChange('')} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
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
