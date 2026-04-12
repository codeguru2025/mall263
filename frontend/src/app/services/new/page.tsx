'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function NewServicePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isSeller = user ? ['STALL_OWNER', 'ATTENDANT'].includes(user.role) : false;

  const [stallId, setStallId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceFrom, setPriceFrom] = useState('');

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, router]);

  const { data: merchant } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data),
    enabled: isAuthenticated && isSeller,
  });

  const { data: stalls } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: !!merchant?.id,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data),
  });

  useEffect(() => {
    if (!stallId && stalls?.length) setStallId(stalls[0].id);
  }, [stalls, stallId]);

  const noStalls = isSeller && stalls && stalls.length === 0 && merchant;

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/api/v1/services', {
        stallId,
        title: title.trim(),
        description: description.trim() || undefined,
        categoryId: categoryId || undefined,
        priceFrom: priceFrom ? parseFloat(priceFrom) : undefined,
      }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success('Service listed');
      router.push(`/services/${data.id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Could not create listing'),
  });

  if (!user) return null;
  if (!isSeller) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-navy-700 font-bold text-center">Only sellers can list services.</p>
        <Link href="/services" className="btn-secondary text-sm">
          Browse services
        </Link>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noStalls) {
      toast.error('Create a stall first (seller setup)');
      return;
    }
    if (!stallId) {
      toast.error('Select a stall');
      return;
    }
    if (title.trim().length < 2) {
      toast.error('Add a short title');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      <header className="bg-white border-b border-gray-100 safe-area-top sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/services" className="p-2 rounded-xl hover:bg-gray-50">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <h1 className="font-black text-navy-700">List a service</h1>
        </div>
      </header>

      <form onSubmit={submit} className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {noStalls ? (
          <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-2xl p-4">
            You need an active stall before listing services.{' '}
            <Link href="/seller/setup" className="font-bold text-brand-orange hover:underline">
              Complete setup
            </Link>
          </p>
        ) : (
        <div>
          <label className="label">Stall</label>
          <select className="input" value={stallId} onChange={(e) => setStallId(e.target.value)} required>
            {(stalls || []).map((st: any) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
        )}
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Phone screen repair" required minLength={2} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[100px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What you offer, timing, what the client should bring…" />
        </div>
        <div>
          <label className="label">Category (optional)</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">—</option>
            {(categories || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Starting price (USD, optional)</label>
          <input type="number" step="0.01" min="0" className="input" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} placeholder="e.g. 15" />
        </div>
        <button type="submit" disabled={mutation.isPending || !!noStalls} className="btn-primary w-full flex items-center justify-center gap-2">
          {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          Publish service
        </button>
      </form>
    </div>
  );
}
