'use client';

import { useRef, useEffect } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, ShoppingBag } from 'lucide-react';
import api from '@/lib/api';
import ProductCard from './ProductCard';

interface Props {
  mallId?: string | null;
  categoryId?: string | null;
}

export default function InfiniteProductFeed({ mallId, categoryId }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data),
    staleTime: 300_000,
  });
  const activeCategoryName = categoryId
    ? categories.find((c: any) => c.id === categoryId)?.name
    : null;

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['product-feed', mallId || '', categoryId || ''],
    queryFn: ({ pageParam }) =>
      api.get('/api/v1/products/browse', {
        params: {
          page: pageParam,
          limit: 20,
          sortBy: 'popular',
          mallId: mallId || undefined,
          categoryId: categoryId || undefined,
        },
      }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + (p.data?.length || 0), 0);
      return loaded < (lastPage.total || 0) ? allPages.length + 1 : undefined;
    },
    staleTime: 60_000,
  });

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const products = data?.pages.flatMap((p) => p.data || []) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-navy-700">
          {activeCategoryName ? activeCategoryName : 'Recommended For You'}
        </h2>
        {activeCategoryName && (
          <span className="text-xs text-gray-400 font-semibold">
            Filtered by category
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="aspect-square bg-gray-100 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="bg-gray-100 rounded h-4 w-3/4 animate-pulse" />
                <div className="bg-gray-100 rounded h-5 w-1/2 animate-pulse" />
                <div className="bg-gray-100 rounded h-3 w-2/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="font-black text-navy-700 text-lg mb-1">No products found</p>
          <p className="text-sm text-gray-500">Try changing your filters or check back later</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((product: any, i: number) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />

          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
            </div>
          )}

          {!hasNextPage && products.length > 0 && (
            <p className="text-center text-xs text-gray-400 py-6">You&apos;ve seen everything!</p>
          )}
        </>
      )}
    </div>
  );
}
