'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { resolveStoreLogo } from '@/lib/storeBranding';
import { BLUR_DATA_URL } from '@/lib/image-placeholder';
import { Logo } from '@/components/Logo';
import { ArrowLeft, MapPin, ShoppingBag, Eye, Zap } from 'lucide-react';

export default function PublicStorePage() {
  const { stallId } = useParams<{ stallId: string }>();
  const queryClient = useQueryClient();
  const visitOnce = useRef(false);

  const { data: stall, isLoading: stallLoading, isError: stallError } = useQuery({
    queryKey: ['stall', stallId],
    queryFn: () => api.get(`/api/v1/stalls/${stallId}`).then((r) => r.data),
    enabled: !!stallId,
  });

  useEffect(() => {
    if (!stallId || visitOnce.current) return;
    visitOnce.current = true;
    api
      .post(`/api/v1/stalls/${stallId}/visit`)
      .then(() => queryClient.invalidateQueries({ queryKey: ['stall', stallId] }))
      .catch(() => {});
  }, [stallId, queryClient]);

  const catalog = useInfiniteQuery({
    queryKey: ['store-catalog', stallId],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const r = await api.get('/api/v1/products/browse', {
        params: { stallId, page: pageParam, limit: 24, sortBy: 'newest' },
      });
      return r.data as {
        data: any[];
        page: number;
        totalPages: number;
      };
    },
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !!stallId && !!stall,
  });

  const products = useMemo(
    () => catalog.data?.pages.flatMap((p) => p.data) ?? [],
    [catalog.data?.pages],
  );

  const storeLogo = stall ? resolveStoreLogo(stall, stall.merchant) : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-8">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 safe-area-top">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/marketplace" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={28} />
          <span className="font-black text-navy-700 text-sm sm:text-base truncate">Store</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {stallLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stallError || !stall ? (
          <div className="text-center py-20">
            <p className="font-bold text-navy-700">Store not found</p>
            <Link href="/marketplace" className="text-brand-blue font-semibold text-sm mt-3 inline-block">
              Back to marketplace
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden relative flex-shrink-0 mx-auto sm:mx-0">
                  {storeLogo ? (
                    <Image src={storeLogo} alt="" fill className="object-contain p-2" sizes="80px" />
                  ) : (
                    <ShoppingBag className="w-10 h-10 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left min-w-0">
                  {stall.merchant?.businessName && (
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                      {stall.merchant.businessName}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-black text-navy-700 leading-tight">{stall.name}</h1>
                    {stall.isPromoted && (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                        <Zap className="w-2.5 h-2.5 fill-amber-600 text-amber-600" /> Featured
                      </span>
                    )}
                  </div>
                  {stall.stallNumber && stall.stallNumber !== '***' && (
                    <p className="text-sm text-gray-500 mt-1">
                      {stall.mall ? `Stall ${stall.stallNumber}` : `Shop ${stall.stallNumber}`}
                    </p>
                  )}
                  {stall.mall ? (
                    <p className="text-sm text-gray-500 flex items-center justify-center sm:justify-start gap-1 mt-2">
                      <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0" />
                      <span>
                        {stall.mall.name !== '🔒 Fund wallet to see seller'
                          ? `${stall.mall.name}, ${stall.mall.city}`
                          : stall.mall.city}
                      </span>
                    </p>
                  ) : stall.address ? (
                    <p className="text-sm text-gray-500 flex items-center justify-center sm:justify-start gap-1 mt-2">
                      <MapPin className="w-4 h-4 text-brand-orange flex-shrink-0" />
                      <span>{stall.address}</span>
                    </p>
                  ) : null}
                  {stall.stallNumber === '***' && (
                    <Link
                      href="/wallet"
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-brand-orange bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5"
                    >
                      🔒 Fund wallet to see full location
                    </Link>
                  )}
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-3 text-xs text-gray-400">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{stall.viewCount ?? 0} store views</span>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="font-black text-navy-700 mb-4">Products</h2>

            {catalog.isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-200 animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <p className="text-gray-500 text-center py-12">No active listings yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((p: any) => {
                    const img =
                      p.images?.[0]?.cdnUrl || p.images?.[0]?.url || p.imageUrl || '';
                    const price = parseFloat(p.minPrice);
                    return (
                      <Link
                        key={p.id}
                        href={`/marketplace/${p.id}`}
                        className="group block bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-brand-orange transition-colors"
                      >
                        <div className="relative aspect-square bg-white">
                          {img ? (
                            <Image
                              src={img}
                              alt={p.name}
                              fill
                              className="object-contain p-2 group-hover:scale-[1.02] transition-transform"
                              sizes="(max-width: 640px) 50vw, 25vw"
                              placeholder="blur"
                              blurDataURL={BLUR_DATA_URL}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                              <ShoppingBag className="w-10 h-10 text-gray-200" />
                            </div>
                          )}
                        </div>
                        <div className="p-3 border-t border-gray-50">
                          <p className="font-bold text-sm text-navy-700 line-clamp-2 leading-snug">{p.name}</p>
                          {isFinite(price) && price > 0 && (
                            <p className="text-brand-orange font-black text-sm mt-1">{formatCurrency(price)}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {catalog.hasNextPage && (
                  <div className="flex justify-center mt-8">
                    <button
                      type="button"
                      onClick={() => catalog.fetchNextPage()}
                      disabled={catalog.isFetchingNextPage}
                      className="px-6 py-3 rounded-xl bg-navy-700 text-white text-sm font-bold disabled:opacity-50"
                    >
                      {catalog.isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
