'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { buildForYouSearchParams, forYouCacheKey } from '@/lib/forYouSignals';
import { ArrowLeft, ChevronRight, MapPin, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { resolveStoreLogo } from '@/lib/storeBranding';

function resolveImg(p: { images?: { cdnUrl?: string; url?: string }[]; imageUrl?: string }): string {
  return p.imageUrl || p.images?.[0]?.cdnUrl || p.images?.[0]?.url || '';
}

function formatPrice(p: { minPrice?: unknown }): string {
  const n = typeof p.minPrice === 'number' ? p.minPrice : parseFloat(String(p.minPrice ?? ''));
  return Number.isFinite(n) && n > 0 ? formatCurrency(n) : 'See details';
}

function trustScore(product: any): number {
  const raw = product?.stall?.merchant?.user?.trustScore?.overallScore;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '50'));
  return Number.isFinite(n) ? n : 50;
}

function ForYouProductCard({ product, priority }: { product: any; priority?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const src = resolveImg(product);
  const hasImage = !!src && !imgError;
  const stallName = product.stall?.name || 'Market stall';
  const mallLine = [product.stall?.mall?.name, product.stall?.mall?.city].filter(Boolean).join(' · ');
  const categoryName = product.category?.name;
  const storeLogo = resolveStoreLogo(product.stall, product.stall?.merchant);
  const trusted = trustScore(product) >= 70;

  return (
    <section className="snap-start shrink-0 h-[calc(100dvh-3.75rem)] min-h-[520px] w-full max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto px-3 sm:px-4 py-2 sm:py-4">
      <div className="relative h-full rounded-[1.35rem] sm:rounded-[1.75rem] overflow-hidden bg-navy-950 shadow-[0_32px_90px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.12]">
        {/* Image */}
        <div className="absolute inset-0">
          {hasImage ? (
            <Image
              src={src}
              alt={product.name || 'Product'}
              fill
              className="object-cover object-center scale-[1.02]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 36rem, 42rem"
              priority={priority}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-navy-800 to-navy-950">
              <ShoppingBag className="w-20 h-20 text-white/[0.12]" strokeWidth={1} />
            </div>
          )}
        </div>

        {/* Atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-950/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/5 via-transparent to-brand-orange/10 pointer-events-none" />

        {/* Top meta */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 sm:p-5 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {categoryName ? (
              <span className="inline-flex items-center rounded-full bg-black/35 backdrop-blur-md border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
                {categoryName}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-black/35 backdrop-blur-md border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
              For you
            </span>
          </div>
          {trusted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 backdrop-blur-md border border-amber-300/35 text-amber-100 text-[10px] font-bold px-2.5 py-1 shadow-sm">
              <Star className="w-3 h-3 fill-amber-300 text-amber-200" />
              Trusted
            </span>
          ) : null}
        </div>

        {/* Bottom glass panel */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-5 pb-6 sm:pb-7 safe-area-bottom">
          <div className="rounded-2xl sm:rounded-[1.35rem] bg-white/[0.09] backdrop-blur-2xl border border-white/[0.14] shadow-[0_12px_48px_rgba(0,0,0,0.35)] p-4 sm:p-5">
            {/* Store row */}
            <div className="flex items-center gap-3 mb-3 min-w-0">
              <div className="relative h-11 w-11 sm:h-12 sm:w-12 rounded-xl overflow-hidden bg-white/10 ring-1 ring-white/20 flex-shrink-0">
                {storeLogo ? (
                  <Image src={storeLogo} alt="" fill className="object-cover" sizes="48px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-brand-orange/90" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-sm sm:text-base truncate leading-tight">{stallName}</p>
                {mallLine ? (
                  <p className="text-white/50 text-[11px] sm:text-xs font-medium truncate mt-0.5">{mallLine}</p>
                ) : null}
              </div>
            </div>

            <h2 className="text-white font-black text-xl sm:text-2xl leading-[1.15] tracking-tight line-clamp-2 mb-3">
              {product.name || 'Product'}
            </h2>

            <div className="flex items-end justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/45 mb-0.5">From</p>
                <p className="text-brand-orange font-black text-2xl sm:text-3xl tabular-nums tracking-tight">
                  {formatPrice(product)}
                </p>
              </div>
            </div>

            <Link
              href={`/marketplace/${product.id}`}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-white text-navy-900 font-black text-sm sm:text-[15px] py-3.5 sm:py-4 shadow-[0_8px_30px_rgba(255,255,255,0.12)] active:scale-[0.98] transition-transform hover:bg-white/95"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              View product
              <ChevronRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedSkeleton() {
  return (
    <div className="h-[calc(100dvh-3.75rem)] min-h-[520px] w-full max-w-lg sm:max-w-xl lg:max-w-2xl mx-auto px-3 sm:px-4 py-2 sm:py-4 shrink-0">
      <div className="h-full rounded-[1.35rem] sm:rounded-[1.75rem] overflow-hidden bg-navy-800/80 ring-1 ring-white/10 animate-pulse">
        <div className="h-full bg-gradient-to-t from-navy-900 via-navy-800/50 to-navy-800" />
      </div>
    </div>
  );
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
    <div className="h-dvh flex flex-col bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(59,154,225,0.18),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(247,148,29,0.08),transparent_45%),#0a101d]">
      <header className="flex-shrink-0 safe-area-top z-20 px-4 py-3 flex items-center justify-between border-b border-white/[0.08] bg-navy-900/80 backdrop-blur-xl">
        <Link
          href="/"
          className="text-white p-2 -ml-2 rounded-xl hover:bg-white/10 transition-colors"
          aria-label="Back home"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-orange/30 to-brand-blue/25 ring-1 ring-white/15">
            <Sparkles className="w-4 h-4 text-brand-orange" />
          </div>
          <div className="text-left">
            <span className="font-black text-sm tracking-tight block leading-none">For You</span>
            <span className="text-[9px] font-semibold text-white/40 uppercase tracking-widest">Curated feed</span>
          </div>
        </div>
        <Link
          href="/marketplace"
          className="text-xs font-bold text-brand-orange hover:text-brand-orange/90 whitespace-nowrap py-2 px-1"
        >
          Browse all
        </Link>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth overscroll-y-contain pb-24 sm:pb-6">
        {isLoading ? (
          <>
            <FeedSkeleton />
            <FeedSkeleton />
          </>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[min(560px,calc(100dvh-8rem))] px-8 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
              <ShoppingBag className="w-10 h-10 text-white/25" strokeWidth={1.25} />
            </div>
            <p className="font-black text-xl text-white mb-2 tracking-tight">Nothing here yet</p>
            <p className="text-sm text-white/55 mb-8 max-w-sm leading-relaxed font-medium">
              Browse products you like — we learn from what you view and mix in fresh picks tailored to you.
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center rounded-2xl bg-white text-navy-900 font-black text-sm px-8 py-3.5 shadow-lg shadow-black/20 active:scale-[0.98] transition-transform"
            >
              Explore marketplace
            </Link>
          </div>
        ) : (
          products.map((p: any, i: number) => <ForYouProductCard key={p.id} product={p} priority={i < 2} />)
        )}
        <div ref={sentinelRef} className="h-12 shrink-0" aria-hidden />
        {isFetchingNextPage ? (
          <p className="text-center text-white/40 text-xs font-semibold py-6 tracking-wide">Loading more picks…</p>
        ) : null}
      </div>
    </div>
  );
}
