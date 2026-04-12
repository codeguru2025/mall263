'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Trash2, Upload } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const r = await api.post('/api/v1/upload/image', formData);
  return r.data.cdnUrl || r.data.url;
}

export default function SellerBrandingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const queryClient = useQueryClient();
  const merchantInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (user && user.role !== 'STALL_OWNER') {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, user, router]);

  const { data: merchant, isError: noMerchant } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data),
    enabled: isAuthenticated && user?.role === 'STALL_OWNER',
  });

  const { data: stalls = [] } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: !!merchant?.id,
  });

  const patchMerchant = useMutation({
    mutationFn: (logoUrl: string | null) =>
      api.patch('/api/v1/merchants/me/branding', { logoUrl }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Business logo updated');
      queryClient.invalidateQueries({ queryKey: ['my-merchant'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Update failed'),
  });

  const patchStall = useMutation({
    mutationFn: ({ stallId, logoUrl }: { stallId: string; logoUrl: string | null }) =>
      api.patch(`/api/v1/stalls/${stallId}`, { logoUrl }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Stall logo updated');
      queryClient.invalidateQueries({ queryKey: ['my-stalls'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Update failed'),
  });

  const onPickMerchantLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (merchantInputRef.current) merchantInputRef.current.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image must be under 15 MB');
      return;
    }
    setUploading('merchant');
    try {
      const url = await uploadImageFile(file);
      patchMerchant.mutate(url);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const onPickStallLogo = async (stallId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image must be under 15 MB');
      return;
    }
    setUploading(stallId);
    try {
      const url = await uploadImageFile(file);
      patchStall.mutate({ stallId, logoUrl: url });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/inventory" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Store branding</h1>
            <p className="text-xs text-gray-500">Logos appear on receipts and product listings</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {noMerchant ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="font-bold text-navy-700 mb-2">No merchant profile</p>
            <Link href="/seller/setup" className="text-brand-green font-bold text-sm">
              Complete seller setup
            </Link>
          </div>
        ) : (
          <>
            <section className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <h2 className="font-black text-navy-700 mb-1">Business logo</h2>
              <p className="text-sm text-gray-500 mb-4">
                Used as a fallback when a stall does not have its own logo.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden relative flex-shrink-0">
                  {merchant?.logoUrl ? (
                    <Image src={merchant.logoUrl} alt="" fill className="object-contain p-2" sizes="96px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 text-center px-2">
                      No logo
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={merchantInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPickMerchantLogo}
                  />
                  <button
                    type="button"
                    onClick={() => merchantInputRef.current?.click()}
                    disabled={uploading === 'merchant' || patchMerchant.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-700 text-white text-sm font-bold disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading === 'merchant' ? 'Uploading…' : 'Upload logo'}
                  </button>
                  {merchant?.logoUrl && (
                    <button
                      type="button"
                      onClick={() => patchMerchant.mutate(null)}
                      disabled={patchMerchant.isPending}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-black text-navy-700 px-1">Stall logos</h2>
              {stalls.length === 0 ? (
                <p className="text-sm text-gray-500 px-1">No stalls yet.</p>
              ) : (
                stalls.map((s: any) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-2xl border-2 border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden relative flex-shrink-0">
                        {s.logoUrl ? (
                          <Image src={s.logoUrl} alt="" fill className="object-contain p-1.5" sizes="64px" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 px-1 text-center">
                            Stall
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-navy-700 truncate">{s.name}</p>
                        <p className="text-xs text-gray-500">Stall {s.stallNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`stall-logo-${s.id}`}
                        onChange={(ev) => onPickStallLogo(s.id, ev)}
                      />
                      <label
                        htmlFor={`stall-logo-${s.id}`}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-green text-white text-sm font-bold cursor-pointer ${
                          uploading === s.id ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        {uploading === s.id ? '…' : 'Upload'}
                      </label>
                      {s.logoUrl && (
                        <button
                          type="button"
                          onClick={() => patchStall.mutate({ stallId: s.id, logoUrl: null })}
                          disabled={patchStall.isPending}
                          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
                          title="Remove logo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
