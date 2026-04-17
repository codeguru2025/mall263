'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { buildForYouSearchParams, forYouCacheKey } from '@/lib/forYouSignals';
import { ArrowLeft, Bookmark, ChevronRight, ExternalLink, MapPin, Share2, ShoppingBag, Sparkles, Star, Store, X } from 'lucide-react';
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
  const [saved, setSaved] = useState(false);
  const src = resolveImg(product);
  const hasImage = !!src && !imgError;
  const stallName = product.stall?.name || 'Market stall';
  const mallLine = product.stall?.mall
    ? [product.stall.mall.name, product.stall.mall.city].filter(Boolean).join(' · ')
    : (product.stall?.address ?? '');
  const categoryName = product.category?.name;
  const storeLogo = resolveStoreLogo(product.stall, product.stall?.merchant);
  const trusted = trustScore(product) >= 70;

  function handleShare() {
    const url = `${window.location.origin}/marketplace/${product.id}`;
    if (navigator.share) {
      navigator.share({ title: product.name, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).catch(() => {});
    }
  }

  return (
    /* True full-bleed — no padding, no rounded corners on mobile */
    <div className="snap-start shrink-0 h-[calc(100dvh-3.5rem)] w-full relative bg-black overflow-hidden sm:px-3 sm:py-2 sm:h-[calc(100dvh-3.75rem)]">
      {/* Inner wrapper: rounded on tablet+, full bleed on mobile */}
      <div className="relative h-full w-full sm:rounded-2xl overflow-hidden">
        {/* Full-bleed image */}
        <div className="absolute inset-0">
          {hasImage ? (
            <Image
              src={src}
              alt={product.name || 'Product'}
              fill
              className="object-cover object-center"
              sizes="100vw"
              priority={priority}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-black">
              <ShoppingBag className="w-24 h-24 text-white/10" strokeWidth={1} />
            </div>
          )}
        </div>

        {/* Gradient layers — strong at bottom, soft vignette at top */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/35 pointer-events-none" />

        {/* ── Top badges ── */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
          {categoryName && (
            <span className="inline-flex items-center rounded-full bg-black/45 backdrop-blur-md border border-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/85">
              {categoryName}
            </span>
          )}
          {trusted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 backdrop-blur-md border border-amber-300/30 text-amber-100 text-[10px] font-bold px-2.5 py-0.5">
              <Star className="w-3 h-3 fill-amber-300 text-amber-200" />
              Trusted
            </span>
          )}
        </div>

        {/* ── Right-side action column (TikTok-style) ── */}
        <div className="absolute right-3 bottom-32 z-10 flex flex-col items-center gap-5">
          {/* Save / Bookmark */}
          <button
            onClick={() => setSaved((v) => !v)}
            className="flex flex-col items-center gap-1.5 group"
            aria-label={saved ? 'Unsave product' : 'Save product'}
          >
            <div
              className={`w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center transition-colors ${
                saved ? 'bg-brand-orange/25 ring-1 ring-brand-orange/40' : 'bg-black/40 ring-1 ring-white/15'
              }`}
            >
              <Bookmark
                className={`w-5 h-5 transition-all ${saved ? 'fill-brand-orange text-brand-orange scale-110' : 'text-white'}`}
              />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">{saved ? 'Saved' : 'Save'}</span>
          </button>

          {/* Store avatar */}
          <Link
            href={`/stores/${product.stall?.id ?? ''}`}
            className="flex flex-col items-center gap-1.5"
            aria-label="Visit store"
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl ring-2 ring-white/25 overflow-hidden relative flex items-center justify-center">
              {storeLogo ? (
                <Image src={storeLogo} alt="" fill className="object-cover" sizes="48px" />
              ) : (
                <Store className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">Store</span>
          </Link>

          {/* Share */}
          <button onClick={handleShare} className="flex flex-col items-center gap-1.5" aria-label="Share product">
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl ring-1 ring-white/15 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-[10px] font-semibold drop-shadow">Share</span>
          </button>
        </div>

        {/* ── Bottom content — text directly over gradient, no panel box ── */}
        <div className="absolute bottom-0 left-0 right-16 z-10 px-4 pb-6 pt-12 safe-area-bottom">
          {/* Store identity row */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-white/15 ring-1 ring-white/30 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
              {storeLogo ? (
                <Image src={storeLogo} alt="" fill className="object-cover" sizes="32px" />
              ) : (
                <MapPin className="w-4 h-4 text-white/60" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm leading-tight truncate">{stallName}</p>
              {mallLine ? (
                <p className="text-white/50 text-[11px] font-medium truncate">{mallLine}</p>
              ) : null}
            </div>
          </div>

          {/* Product name */}
          <h2 className="text-white font-black text-[1.65rem] sm:text-3xl leading-[1.1] tracking-tight line-clamp-2 mb-3 drop-shadow-sm">
            {product.name || 'Product'}
          </h2>

          {/* Price + CTA */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-0.5 leading-none">From</p>
              <p className="text-brand-orange font-black text-[1.6rem] sm:text-3xl tabular-nums leading-none drop-shadow">
                {formatPrice(product)}
              </p>
            </div>
            <Link
              href={`/marketplace/${product.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-white text-navy-900 font-black text-[13px] py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] active:scale-[0.97] transition-transform"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              View product
              <ChevronRight className="w-4 h-4 opacity-60" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="snap-start shrink-0 h-[calc(100dvh-3.5rem)] w-full bg-black overflow-hidden sm:px-3 sm:py-2 sm:h-[calc(100dvh-3.75rem)]">
      <div className="h-full w-full sm:rounded-2xl overflow-hidden animate-pulse">
        <div className="h-full bg-gradient-to-t from-slate-900 via-slate-800/50 to-slate-800" />
      </div>
    </div>
  );
}

// Full-screen interstitial ad card for the feed
function FeedAdCard({ ad }: { ad: { id: string; title: string; imageUrl?: string | null; linkUrl?: string | null } }) {
  const [dismissed, setDismissed] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      api.post(`/api/v1/ads/${ad.id}/impression`).catch(() => {});
    }
  }, [ad.id]);

  if (dismissed) return null;

  const content = (
    <div className="snap-start shrink-0 h-[calc(100dvh-3.5rem)] w-full relative bg-black overflow-hidden sm:px-3 sm:py-2 sm:h-[calc(100dvh-3.75rem)] flex items-center justify-center">
      {ad.imageUrl ? (
        <>
          <Image src={ad.imageUrl} alt={ad.title} fill className="object-cover opacity-70" sizes="100vw" />
          <div className="absolute inset-0 bg-black/40" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900 to-orange-950" />
      )}
      <div className="relative z-10 text-center px-8">
        <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-white/60 bg-white/10 px-3 py-1 rounded-full mb-4">
          Sponsored
        </span>
        <p className="text-white font-black text-2xl mb-4 leading-tight">{ad.title}</p>
        {ad.linkUrl && (
          <span className="inline-flex items-center gap-2 bg-white text-navy-900 font-black text-sm px-6 py-3 rounded-2xl">
            Learn more <ExternalLink className="w-4 h-4" />
          </span>
        )}
      </div>
      {/* Dismiss */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDismissed(true); }}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors z-20"
        aria-label="Dismiss ad"
      >
        <X className="w-4 h-4 text-white" />
      </button>
    </div>
  );

  if (ad.linkUrl) {
    return (
      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
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

  const { data: adsData } = useQuery<any[]>({
    queryKey: ['ads-interstitial'],
    queryFn: () => api.get('/api/v1/ads/active', { params: { placement: 'INTERSTITIAL' } }).then((r) => r.data ?? []),
    staleTime: 300_000,
  });
  const interstitialAd = adsData?.[0] ?? null;

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
    <div className="h-dvh flex flex-col bg-black">
      {/* Ultra-minimal floating header */}
      <header className="flex-shrink-0 safe-area-top z-20 px-4 py-2.5 flex items-center justify-between">
        <Link
          href="/"
          className="text-white p-1.5 -ml-1.5 rounded-xl hover:bg-white/10 transition-colors"
          aria-label="Back home"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-brand-orange" />
          <span className="text-white font-black text-sm tracking-tight">For You</span>
        </div>

        <Link
          href="/marketplace"
          className="text-brand-orange text-xs font-bold py-1.5 px-1 hover:text-brand-orange/80 transition-colors"
        >
          Browse
        </Link>
      </header>

      {/* Snap scroll feed */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth overscroll-y-contain pb-20 sm:pb-4">
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
            <p className="text-sm text-white/50 mb-8 max-w-sm leading-relaxed font-medium">
              Browse products you like — we learn what you view and mix in fresh picks tailored to you.
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center rounded-2xl bg-white text-navy-900 font-black text-sm px-8 py-3.5 shadow-lg shadow-black/30 active:scale-[0.98] transition-transform"
            >
              Explore marketplace
            </Link>
          </div>
        ) : (
          products.map((p: any, i: number) => (
            <Fragment key={p.id}>
              <ForYouProductCard product={p} priority={i < 2} />
              {/* Show interstitial ad after every 5th product */}
              {interstitialAd && (i + 1) % 5 === 0 && (
                <FeedAdCard ad={interstitialAd} />
              )}
            </Fragment>
          ))
        )}

        <div ref={sentinelRef} className="h-12 shrink-0" aria-hidden />
        {isFetchingNextPage ? (
          <p className="text-center text-white/35 text-xs font-semibold py-6 tracking-wide">Loading more picks…</p>
        ) : null}
      </div>
    </div>
  );
}
