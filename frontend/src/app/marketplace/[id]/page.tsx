'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { resolveStoreLogo } from '@/lib/storeBranding';
import { Logo } from '@/components/Logo';
import { DeliveryCalculator } from '@/components/DeliveryCalculator';
import { ArrowLeft, MapPin, Star, Package, Gavel, ShoppingBag, AlertCircle, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { useState, useEffect } from 'react';
import { recordProductEngagement } from '@/lib/forYouSignals';
import { useAuthStore } from '@/lib/store';
import { BLUR_DATA_URL } from '@/lib/image-placeholder';

// Resolve the best available URL from a product image object
function resolveImageSrc(img: any): string {
  return img?.cdnUrl || img?.url || '';
}

// Safe price — null when missing, zero, or non-finite
function safePrice(raw: any): string | null {
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!isFinite(n) || n <= 0) return null;
  return formatCurrency(n);
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [heroError, setHeroError] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBuyer = user?.role === 'BUYER' || !user;

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/api/v1/products/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: walletData } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => api.get('/api/v1/wallets/me/balance').then((r) => r.data),
    enabled: isAuthenticated && isBuyer,
  });

  const walletBalance = parseFloat(walletData?.available ?? walletData?.availableBalance ?? '0');
  const hasWalletFunds = walletBalance > 0;

  useEffect(() => {
    if (!product?.id) return;
    const mallId = product.stall?.mallId ?? product.stall?.mall?.id ?? null;
    recordProductEngagement({
      productId: product.id,
      categoryId: product.categoryId ?? product.category?.id,
      mallId,
    });
  }, [product?.id, product?.categoryId, product?.category?.id, product?.stall?.mallId, product?.stall?.mall?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Skeleton hero */}
        <div className="w-full aspect-[4/3] sm:aspect-[16/9] bg-gray-200 animate-pulse" />
        <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">
          <div className="h-7 bg-gray-200 rounded-xl w-3/4 animate-pulse" />
          <div className="h-5 bg-gray-200 rounded-xl w-1/3 animate-pulse" />
          <div className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-brand-red" />
        <p className="text-navy-700 font-bold">Product not found</p>
        <Link href="/marketplace" className="btn-primary">Back to Marketplace</Link>
      </div>
    );
  }

  const images: any[] = product.images ?? [];
  // Sort: primary first
  const sortedImages = [...images].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
  const currentImg = sortedImages[imgIndex];
  const heroSrc = heroError ? '' : resolveImageSrc(currentImg);
  const hasHero = !!heroSrc;

  const activeVariant = product.variants?.find((v: any) => v.id === selectedVariant) ?? product.variants?.[0];

  // Use variant price when selected, fall back to product range
  const displayPrice = safePrice(activeVariant?.sellingPrice ?? product.minPrice);
  const minP = parseFloat(product.minPrice);
  const maxP = parseFloat(product.maxPrice);
  const hasRange = isFinite(minP) && isFinite(maxP) && Math.abs(maxP - minP) > 0.001;

  const storeLogoUrl = product.stall
    ? resolveStoreLogo(product.stall, product.stall.merchant)
    : null;
  const stallId = product.stall?.id;

  const prevImg = () => { setImgIndex((i) => Math.max(0, i - 1)); setHeroError(false); };
  const nextImg = () => { setImgIndex((i) => Math.min(sortedImages.length - 1, i + 1)); setHeroError(false); };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto">

        {/* Safe area sits above the image so the photo keeps a clean aspect ratio */}
        <div className="bg-white w-full pt-[env(safe-area-inset-top)]">
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] overflow-hidden bg-white">
          {hasHero ? (
            <Image
              src={heroSrc}
              alt={product.name ?? 'Product'}
              fill
              sizes="(max-width: 640px) 100vw, 672px"
              className="object-cover"
              priority
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              onError={() => setHeroError(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <ShoppingBag className="w-20 h-20 text-gray-300" />
            </div>
          )}

          {/* Gradient vignette — top for nav readability, bottom for price chip */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/55" />

          {/* Floating back + logo */}
          <div className="absolute top-0 left-0 right-0 px-4 pt-3 flex items-center gap-3 sm:pt-4">
            <Link
              href="/marketplace"
              className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow text-white hover:bg-white/30 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <Logo size={26} />
          </div>

          {/* Trusted badge */}
          {product.trustScore >= 70 && (
            <div className="absolute right-4 top-4 flex items-center gap-1 bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
              <Star className="w-3 h-3 fill-white text-white" /> Trusted Seller
            </div>
          )}

          {/* Price chip */}
          {displayPrice && (
            <div className="absolute bottom-4 left-4 bg-black/30 backdrop-blur-lg border border-white/20 text-white font-black text-xl px-4 py-1.5 rounded-2xl shadow-lg">
              {displayPrice}
            </div>
          )}

          {/* Image gallery controls — only show when multiple images */}
          {sortedImages.length > 1 && (
            <>
              {imgIndex > 0 && (
                <button
                  onClick={prevImg}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow hover:bg-black/50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {imgIndex < sortedImages.length - 1 && (
                <button
                  onClick={nextImg}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow hover:bg-black/50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {/* Dot indicators */}
              <div className="absolute bottom-4 right-4 flex items-center gap-1">
                {sortedImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setImgIndex(i); setHeroError(false); }}
                    className={`rounded-full transition-all ${i === imgIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        </div>

        {/* Thumbnail strip — visible when 2+ images */}
        {sortedImages.length > 1 && (
          <div className="flex gap-2 px-4 pt-3 overflow-x-auto no-scrollbar">
            {sortedImages.map((img, i) => {
              const src = resolveImageSrc(img);
              if (!src) return null;
              return (
                <button
                  key={i}
                  onClick={() => { setImgIndex(i); setHeroError(false); }}
                  className={`relative flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                    i === imgIndex ? 'border-brand-blue' : 'border-transparent opacity-60'
                  }`}
                >
                  <Image src={src} alt="" fill className="object-cover" placeholder="blur" blurDataURL={BLUR_DATA_URL} />
                </button>
              );
            })}
          </div>
        )}

        <div className="px-4 pt-5 pb-28 sm:pb-6 space-y-5">
          {/* Name */}
          <div>
            <h1 className="text-2xl font-black text-navy-700 leading-tight mb-0.5">
              {product.name ?? 'Unnamed product'}
            </h1>
            {product.brand && <p className="text-sm text-gray-400 font-medium">{product.brand}</p>}
            {hasRange && (
              <p className="text-sm text-gray-400 mt-1">
                Range: {safePrice(minP) ?? '—'} – {safePrice(maxP) ?? '—'}
              </p>
            )}
          </div>

          {/* Variants */}
          {product.variants?.length > 1 && (
            <div>
              <p className="text-sm font-bold text-navy-700 mb-2">Options</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v.id)}
                    className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                      (selectedVariant ?? product.variants[0]?.id) === v.id
                        ? 'border-brand-blue bg-blue-50 text-brand-blue'
                        : 'border-gray-100 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    {v.name}
                    {v.inventory?.quantity === 0 && <span className="ml-1 text-xs text-gray-400">(out)</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock indicator */}
          {activeVariant && (
            <div className={`flex items-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl ${
              (activeVariant.inventory?.quantity ?? 0) > 0
                ? 'bg-green-50 text-brand-green'
                : 'bg-red-50 text-brand-red'
            }`}>
              <Package className="w-4 h-4" />
              {(activeVariant.inventory?.quantity ?? 0) > 0
                ? `${activeVariant.inventory.quantity} in stock`
                : 'Out of stock'}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="font-bold text-navy-700 mb-2">About this item</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Stall info */}
          {product.stall && (
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <h3 className="font-bold text-navy-700 mb-3">Available at</h3>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                  {storeLogoUrl ? (
                    <Image src={storeLogoUrl} alt="" fill className="object-contain p-1" sizes="48px" />
                  ) : (
                    <MapPin className="w-6 h-6 text-brand-orange" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {product.stall.merchant?.businessName && (
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {product.stall.merchant.businessName}
                    </p>
                  )}
                  <p className="font-bold text-navy-700">{product.stall.name}</p>
                  {product.stall.stallNumber && product.stall.stallNumber !== '***' && (
                    <p className="text-sm text-gray-500">
                      {product.stall.mall ? `Stall ${product.stall.stallNumber}` : `Shop ${product.stall.stallNumber}`}
                    </p>
                  )}
                  {product.stall.mall ? (
                    <p className="text-sm text-gray-500">{product.stall.mall.name}, {product.stall.mall.city}</p>
                  ) : product.stall.address ? (
                    <p className="text-sm text-gray-500">{product.stall.address}</p>
                  ) : null}
                </div>
              </div>
              {stallId && (
                <Link
                  href={`/stores/${stallId}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-blue hover:underline"
                >
                  View store and browse products →
                </Link>
              )}
              <p className="text-sm text-gray-500 mt-3 bg-gray-50 rounded-xl px-4 py-3">
                Visit this stall to purchase. Pay the seller directly in person.
              </p>
            </div>
          )}

          {/* Delivery calculator */}
          <DeliveryCalculator
            stallLat={product.stall?.latitude}
            stallLng={product.stall?.longitude}
            stallName={product.stall?.name}
          />

          {/* Wallet balance prompt for buyers with empty wallets */}
          {isAuthenticated && isBuyer && !hasWalletFunds && (
            <div className="bg-amber-50 rounded-2xl p-4 border-2 border-amber-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Wallet className="w-4 h-4 text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-amber-900 mb-0.5">Fund your wallet to bid</p>
                <p className="text-xs text-amber-700 leading-relaxed mb-2">
                  Posting a demand requires a small wallet balance. Add funds to unlock bidding and secure seller offers.
                </p>
                <Link href="/wallet" className="inline-flex items-center gap-1.5 text-xs font-black text-amber-900 bg-amber-200 hover:bg-amber-300 transition-colors px-3 py-1.5 rounded-lg">
                  <Wallet className="w-3.5 h-3.5" /> Add funds →
                </Link>
              </div>
            </div>
          )}

          {/* I Want This — creates a demand linked to this product */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border-2 border-blue-100">
            <p className="font-bold text-navy-700 mb-1">Want this product?</p>
            <p className="text-sm text-gray-600 mb-4">Post a demand for this item and the seller will respond with an offer. You agree on the price and pay in person or via wallet.</p>
            <Link
              href={`/demands/new?productId=${product.id}&title=${encodeURIComponent(product.name || '')}&brand=${encodeURIComponent(product.brand || '')}&categoryId=${product.categoryId || ''}&stallId=${stallId || ''}&minPrice=${product.minPrice || ''}&maxPrice=${product.maxPrice || ''}`}
              className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2 w-fit"
            >
              <Gavel className="w-4 h-4" /> I Want This
            </Link>
          </div>

          {/* Generic demand CTA */}
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-5 border-2 border-orange-100">
            <p className="font-bold text-navy-700 mb-1">Looking for something different?</p>
            <p className="text-sm text-gray-600 mb-4">Post a general demand and let sellers come to you with their best offers.</p>
            <Link href="/demands/new" className="btn-bid text-sm py-2.5 px-5 flex items-center gap-2 w-fit">
              <Gavel className="w-4 h-4" /> Post a Demand
            </Link>
          </div>

          <div className="h-20 sm:hidden" />
        </div>
      </div>
    </div>
  );
}
