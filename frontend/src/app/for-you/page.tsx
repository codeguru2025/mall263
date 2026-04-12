'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { buildForYouSearchParams, forYouCacheKey } from '@/lib/forYouSignals';
import { ArrowLeft, ShoppingBag, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

function resolveImg(p: any): string {
  return p.images?.[0]?.cdnUrl || p.images?.[0]?.url || '';
}

export default function ForYouPage() {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['for-you-feed', forYouCacheKey()],
    queryFn: ({ pageParam }) =>
      api.get(`/api/v1/products/for-you?${buildForYouSearchParams(pageParam)}`).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      if (last.page >= last.totalPages) return undefined;
      return last.page + 1;
    },
    staleTime: 0,
  });

  const products = data?.pages.flatMap((p) => p.data || []) ?? [];

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="min-h-dvh bg-navy-900 flex flex-col pb-24 sm:pb-8">
      <header className="flex-shrink-0 safe-area-top bg-navy-900/95 border-b border-white/10 px-4 py-3 flex items-center justify-between z-10">
        <Link href="/" className="text-white p-2 -ml-2 rounded-xl hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-5 h-5 text-brand-orange" />
          <span className="font-black text-sm">For You</span>
        </div>
        <Link href="/marketplace" className="text-xs font-bold text-brand-orange whitespace-nowrap">
          Browse all
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-container">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50dvh] text-white/60 text-sm font-semibold">
            Loading picks…
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-white/80 max-w-md mx-auto">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="font-bold text-lg mb-2">Nothing here yet</p>
            <p className="text-sm mb-6 leading-relaxed">
              Browse products you like — we learn from what you view and surface similar deals here, with fresh picks
              mixed in.
            </p>
            <Link href="/marketplace" className="btn-primary inline-block">
              Explore marketplace
            </Link>
          </div>
        ) : (
          products.map((p: any) => {
            const src = resolveImg(p);
            return (
              <section
                key={p.id}
                className="snap-start min-h-[88dvh] flex flex-col relative border-b border-white/10"
              >
                <div className="relative flex-1 min-h-[56dvh] bg-black">
                  {src ? (
                    <Image src={src} alt={p.name} fill className="object-cover" sizes="100vw" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-navy-800">
                      <ShoppingBag className="w-20 h-20 text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 pb-8 safe-area-bottom">
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-wide mb-1">
                      Picked for you
                    </p>
                    <h2 className="text-white font-black text-2xl leading-tight mb-2">{p.name}</h2>
                    <p className="text-brand-orange font-black text-xl mb-4">
                      {(() => {
                        const n = parseFloat(p.minPrice);
                        return Number.isFinite(n) && n > 0 ? formatCurrency(n) : 'See details';
                      })()}
                    </p>
                    <Link
                      href={`/marketplace/${p.id}`}
                      className="inline-flex items-center justify-center w-full py-3.5 rounded-2xl bg-white text-navy-900 font-black text-sm active:scale-[0.98] transition-transform"
                    >
                      View product
                    </Link>
                  </div>
                </div>
              </section>
            );
          })
        )}
        <div ref={sentinelRef} className="h-8" />
        {isFetchingNextPage && (
          <p className="text-center text-white/50 text-xs py-4">Loading more…</p>
        )}
      </div>
    </div>
  );
}
