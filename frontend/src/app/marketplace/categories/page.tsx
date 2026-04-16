'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, LayoutGrid } from 'lucide-react';
import api from '@/lib/api';
import { Logo } from '@/components/Logo';
import { marketplaceCategoryIcon } from '@/lib/marketplaceCategoryIcons';

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export default function MarketplaceCategoriesPage() {
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data),
    staleTime: 300_000,
  });

  const roots = categories
    .filter((c) => !c.parentId && c.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white safe-area-top">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/marketplace" className="p-2 -ml-2 rounded-xl hover:bg-gray-50 text-navy-700">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <Logo size={28} />
          <div>
            <h1 className="text-lg font-black text-navy-700 leading-tight">Categories</h1>
            <p className="text-[11px] text-gray-500 font-medium">Browse by type</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {isLoading ? (
          <div className="px-4 py-8 space-y-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            <li>
              <Link
                href="/marketplace"
                className="flex items-center gap-4 px-4 py-3.5 active:bg-gray-50 transition-colors"
              >
                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-navy-600">
                  <LayoutGrid className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="font-bold text-navy-700">All listings</span>
              </Link>
            </li>
            {roots.map((cat) => {
              const Icon = marketplaceCategoryIcon(cat.slug);
              return (
                <li key={cat.id}>
                  <Link
                    href={`/marketplace?categoryId=${encodeURIComponent(cat.id)}`}
                    className="flex items-center gap-4 px-4 py-3.5 active:bg-gray-50 transition-colors"
                  >
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-navy-600">
                      <Icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <span className="font-semibold text-navy-800 text-[15px]">{cat.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
