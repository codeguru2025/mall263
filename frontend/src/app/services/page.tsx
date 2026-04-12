'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Briefcase, Loader2, X } from 'lucide-react';
import api from '@/lib/api';
import { Logo } from '@/components/Logo';
import { formatCurrency } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks/useDebounce';

function ServicesContent() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const debouncedQ = useDebounce(q, 300);
  const [mallId, setMallId] = useState(searchParams.get('mallId') || searchParams.get('mall') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');

  const sp = searchParams.toString();
  useEffect(() => {
    const p = new URLSearchParams(sp);
    setMallId(p.get('mallId') || p.get('mall') || '');
    setCategoryId(p.get('categoryId') || '');
  }, [sp]);

  const { data: malls = [] } = useQuery<any[]>({
    queryKey: ['malls'],
    queryFn: () => api.get('/api/v1/stalls/malls').then((r) => r.data),
    staleTime: 300_000,
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data),
    staleTime: 300_000,
  });

  const topCategories = categories.filter((c: any) => !c.parentId && c.isActive !== false).slice(0, 12);

  const { data, isLoading } = useQuery({
    queryKey: ['services-browse', debouncedQ, mallId, categoryId],
    queryFn: () =>
      api
        .get('/api/v1/services/browse', {
          params: {
            q: debouncedQ.trim() || undefined,
            mallId: mallId || undefined,
            categoryId: categoryId || undefined,
            limit: 40,
          },
        })
        .then((r) => r.data),
  });

  const rows: any[] = data?.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 safe-area-top">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="flex-shrink-0">
            <Logo size={30} />
          </Link>
          <div className="flex-1 relative">
            <div className="bg-gray-50 rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-blue">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search services…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full py-2.5 bg-transparent text-sm text-navy-700 outline-none font-medium"
              />
              {q && (
                <button type="button" onClick={() => setQ('')} className="text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <Link href="/marketplace" className="text-xs font-bold text-brand-blue whitespace-nowrap hidden sm:inline">
            Products
          </Link>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setMallId('')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${
              !mallId ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            All markets
          </button>
          {(malls as any[]).map((m: any) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMallId(mallId === m.id ? '' : m.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                mallId === m.id ? 'bg-brand-orange text-white border-brand-orange' : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        {topCategories.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setCategoryId('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${
                !categoryId ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              All categories
            </button>
            {topCategories.map((cat: any) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(categoryId === cat.id ? '' : cat.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap ${
                  categoryId === cat.id ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 pb-safe">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-black text-navy-700 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-brand-blue" /> Services
          </h1>
          <Link href="/services/new" className="text-xs font-bold text-brand-orange">
            List a service →
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-sm">
            No services match your filters yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((s: any) => (
              <Link
                key={s.id}
                href={`/services/${s.id}`}
                className="bg-white rounded-2xl border-2 border-gray-100 p-5 hover:border-brand-blue hover:shadow-md transition-all"
              >
                <h2 className="font-bold text-navy-700 mb-1 line-clamp-2">{s.title}</h2>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{s.description || 'Professional service'}</p>
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" />
                  <span className="truncate">
                    {s.stall?.name || s.mall?.name || 'Local provider'}
                  </span>
                </div>
                {s.priceFrom != null && Number(s.priceFrom) > 0 && (
                  <p className="text-sm font-black text-brand-green">From {formatCurrency(Number(s.priceFrom))}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>}>
      <ServicesContent />
    </Suspense>
  );
}
