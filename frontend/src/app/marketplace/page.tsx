'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Star, Gavel, ShoppingBag, Loader2, X, ChevronRight } from 'lucide-react';
import { useState, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { resolveStoreLogo } from '@/lib/storeBranding';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/lib/store';
import { useDebounce } from '@/lib/hooks/useDebounce';

// Resolve image URL — handles Meilisearch flat shape, DB nested, and cdnUrl vs url
function resolveImageUrl(product: any): string {
  return (
    product.imageUrl ||
    product.images?.[0]?.cdnUrl ||
    product.images?.[0]?.url ||
    ''
  );
}

// Safely format a price — returns null when the value is missing or zero
function safePrice(raw: any): string | null {
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  if (!isFinite(n) || n <= 0) return null;
  return formatCurrency(n);
}

// Individual card — needs its own state for image-load errors
function ProductCard({ product }: { product: any }) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = resolveImageUrl(product);
  const hasImage = !!imgUrl && !imgError;
  const stallName = product.stallName || product.stall?.name || 'Market Stall';
  const cityLabel = product.city || product.stall?.mall?.city || '';
  const priceLabel = safePrice(product.minPrice);
  const storeLogoUrl =
    product.storeLogoUrl || resolveStoreLogo(product.stall, product.stall?.merchant);

  return (
    <Link
      href={`/marketplace/${product.id}`}
      className="group relative block aspect-[3/4] rounded-[18px] overflow-hidden shadow-[0_2px_14px_rgba(0,0,0,0.10)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.20)] transition-shadow duration-300 active:scale-[0.97] select-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Background — white so transparent PNGs look clean */}
      <div className="absolute inset-0 bg-white" />

      {/* Full-bleed image */}
      {hasImage ? (
        <Image
          src={imgUrl}
          alt={product.name || 'Product'}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out"
          priority={product.trustScore >= 70}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <ShoppingBag className="w-12 h-12 text-gray-300" />
        </div>
      )}

      {/* Gradient overlay — only when we have an image, so the ShoppingBag fallback stays visible */}
      {hasImage && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      )}

      {/* Trusted badge — glassmorphism, top-right */}
      {product.trustScore >= 70 && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-white/20 backdrop-blur-md border border-white/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          <Star className="w-2.5 h-2.5 fill-white text-white" />
          Trusted
        </div>
      )}

      {/* Info overlay — only rendered when there's an image so text is on the gradient */}
      {hasImage ? (
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8">
          <p className="text-white font-semibold text-[13px] leading-[1.3] line-clamp-2 mb-1.5 drop-shadow">
            {product.name || 'Unnamed product'}
          </p>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-white/60 text-[11px] font-medium truncate flex items-center gap-1">
                {storeLogoUrl ? (
                  <span className="relative w-5 h-5 rounded-md overflow-hidden bg-white/20 flex-shrink-0 ring-1 ring-white/30">
                    <Image src={storeLogoUrl} alt="" fill className="object-contain p-0.5" sizes="20px" />
                  </span>
                ) : (
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0 text-brand-orange" />
                )}
                {stallName}
              </span>
              {cityLabel ? (
                <p className="text-white/45 text-[10px] font-medium mt-0.5 truncate">{cityLabel}</p>
              ) : null}
            </div>
            <span className="text-white font-black text-sm flex-shrink-0 drop-shadow">
              {priceLabel ?? '—'}
            </span>
          </div>
        </div>
      ) : (
        /* Fallback info below the icon when no image */
        <div className="absolute bottom-0 left-0 right-0 bg-white px-3 pb-3 pt-2">
          <p className="font-semibold text-[13px] text-navy-700 line-clamp-2 leading-[1.3] mb-1">
            {product.name || 'Unnamed product'}
          </p>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-gray-400 text-[11px] truncate flex items-center gap-1">
                {storeLogoUrl ? (
                  <span className="relative w-5 h-5 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 ring-1 ring-gray-200">
                    <Image src={storeLogoUrl} alt="" fill className="object-contain p-0.5" sizes="20px" />
                  </span>
                ) : (
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0 text-brand-orange" />
                )}
                {stallName}
              </span>
              {cityLabel ? <p className="text-gray-400 text-[10px] mt-0.5 truncate">{cityLabel}</p> : null}
            </div>
            <span className="text-navy-700 font-black text-sm flex-shrink-0">
              {priceLabel ?? '—'}
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const debouncedQuery = useDebounce(query, 300);
  const [selectedMall, setSelectedMall] = useState(
    () => searchParams.get('mallId') || searchParams.get('mall') || '',
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('categoryId') || '');
  const [selectedCity, setSelectedCity] = useState(() => searchParams.get('city') || '');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const user = useAuthStore((s) => s.user);
  const isSeller = user ? ['STALL_OWNER', 'ATTENDANT'].includes(user.role) : false;

  useEffect(() => { setPage(1); }, [debouncedQuery, selectedCategoryId, selectedMall, selectedCity]);

  const urlSig = searchParams.toString();
  useEffect(() => {
    const params = new URLSearchParams(urlSig);
    const m = params.get('mallId') || params.get('mall') || '';
    const c = params.get('categoryId') || '';
    const city = params.get('city') || '';
    setSelectedMall(m);
    setSelectedCategoryId(c);
    setSelectedCity(city);
  }, [urlSig]);

  // Keep URL in sync so shares / back-button work
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (selectedCategoryId) params.set('categoryId', selectedCategoryId);
    if (selectedMall) params.set('mallId', selectedMall);
    if (selectedCity.trim()) params.set('city', selectedCity.trim());
    const qs = params.toString();
    router.replace(qs ? `/marketplace?${qs}` : '/marketplace', { scroll: false });
  }, [debouncedQuery, selectedCategoryId, selectedMall, selectedCity, router]);

  const { data: malls = [] } = useQuery<any[]>({
    queryKey: ['malls'],
    queryFn: () => api.get('/api/v1/stalls/malls').then((r) => r.data),
    staleTime: 300_000,
  });

  const cityOptions = Array.from(
    new Set((malls as { city?: string }[]).map((m) => (m.city || '').trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data),
    staleTime: 300_000,
  });

  const topCategories = categories.filter((c: any) => !c.parentId && c.isActive !== false).slice(0, 12);
  const activeCategoryName = selectedCategoryId
    ? categories.find((c: any) => c.id === selectedCategoryId)?.name
    : null;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery.trim(), selectedMall, selectedCategoryId, selectedCity.trim(), sortBy, page],
    queryFn: () =>
      api.get('/api/v1/search', {
        params: {
          q: debouncedQuery.trim() || undefined,
          mallId: selectedMall || undefined,
          categoryId: selectedCategoryId || undefined,
          city: selectedCity.trim() || undefined,
          sortBy,
          page,
          limit: 20,
        },
      }).then((r) => r.data),
    placeholderData: (prev: any) => prev,
    staleTime: 120_000,
    gcTime: 300_000,
  });

  const products: any[] = data?.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 safe-area-top">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex-shrink-0"><Logo size={30} /></Link>
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-navy-600">
              <Link href="/for-you" className="px-2 py-1 rounded-lg hover:bg-gray-50 whitespace-nowrap">For You</Link>
              <Link href="/services" className="px-2 py-1 rounded-lg hover:bg-gray-50 whitespace-nowrap">Services</Link>
            </div>
            <div className="flex-1 relative">
              <div className="bg-gray-50 rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-blue focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search products, brands..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full py-2.5 bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none font-medium"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
                {(debouncedQuery !== query || isFetching) && (
                  <Loader2 className="w-4 h-4 text-brand-orange animate-spin flex-shrink-0" />
                )}
              </div>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border-2 border-gray-100 rounded-xl py-2.5 px-3 text-sm bg-white font-semibold text-navy-700 focus:border-brand-blue outline-none hidden sm:block"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
              <option value="popular">Popular</option>
              <option value="trust">Trusted</option>
            </select>
          </div>

          {/* Category filter strip */}
          <div className="sm:hidden flex items-center gap-3 pt-2 pb-1 px-1">
            <Link href="/for-you" className="text-xs font-bold text-brand-orange whitespace-nowrap">
              For You
            </Link>
            <Link href="/services" className="text-xs font-bold text-brand-blue whitespace-nowrap">
              Services
            </Link>
          </div>
          {topCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-2 pb-1 -mx-1 px-1 items-center">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  !selectedCategoryId
                    ? 'bg-brand-orange text-white border-brand-orange'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                All
              </button>
              {topCategories.map((cat: any) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? '' : cat.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
                    selectedCategoryId === cat.id
                      ? 'bg-brand-orange text-white border-brand-orange'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              <Link
                href="/marketplace/categories"
                className="flex-shrink-0 flex items-center gap-0.5 pl-1 pr-2 py-1.5 text-xs font-black text-brand-blue whitespace-nowrap"
              >
                See all
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Location — cities from malls (Facebook-style area filter) */}
          {cityOptions.length > 0 && (
            <div className="flex items-center gap-2 pt-2 pb-2 border-t border-gray-50 mt-1">
              <MapPin className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" aria-hidden />
              <span className="text-[10px] font-black uppercase tracking-wide text-gray-400 flex-shrink-0 w-14">
                Area
              </span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0 pb-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedCity('')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    !selectedCity.trim()
                      ? 'bg-navy-700 text-white border-navy-700'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Everywhere
                </button>
                {cityOptions.map((city) => (
                  <button
                    type="button"
                    key={city}
                    onClick={() => setSelectedCity(selectedCity === city ? '' : city)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition-all ${
                      selectedCity === city
                        ? 'bg-navy-700 text-white border-navy-700'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 pb-safe">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-[18px] overflow-hidden animate-pulse bg-gray-200 aspect-[3/4]" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-black text-navy-700 tracking-tight">
                  {activeCategoryName
                    ? activeCategoryName
                    : debouncedQuery
                    ? `"${debouncedQuery}"`
                    : 'Browse'}
                </h1>
                <p className="text-xs text-gray-400 font-medium">
                  {data?.total || 0} products
                  {selectedCity.trim() ? ` · ${selectedCity.trim()}` : ''}
                </p>
              </div>
              {!isSeller && (
                <Link href="/demands/new" className="btn-bid text-xs py-2 px-3.5 flex items-center gap-1.5">
                  <Gavel className="w-3.5 h-3.5" /> Post Demand
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {products.length === 0 && (
              <div className="text-center py-20">
                <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-xl font-black text-navy-700 mb-2">No products found</h3>
                <p className="text-gray-500 mb-4">
                  {debouncedQuery
                    ? `No results for "${debouncedQuery}" — try a different word`
                    : 'Check back later or adjust your filters'}
                </p>
                {selectedCategoryId && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('')}
                    className="btn-secondary text-sm mr-3"
                  >
                    Clear category filter
                  </button>
                )}
                {selectedCity.trim() && (
                  <button
                    type="button"
                    onClick={() => setSelectedCity('')}
                    className="btn-secondary text-sm mr-3"
                  >
                    Clear location
                  </button>
                )}
                {!isSeller && (
                  <Link href="/demands/new" className="btn-primary text-sm">
                    Post a Demand Instead
                  </Link>
                )}
              </div>
            )}

            {(data?.total || 0) > 20 && (
              <div className="flex justify-center mt-8 gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="py-2.5 px-4 text-sm font-bold text-navy-700 bg-white rounded-xl border-2 border-gray-100">
                  Page {page}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= (data?.total || 0)}
                  className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceContent />
    </Suspense>
  );
}
