'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, Star, Gavel, ShoppingBag, Loader2, X } from 'lucide-react';
import { useState, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/lib/store';
import { useDebounce } from '@/lib/hooks/useDebounce';

// Resolve image URL regardless of source shape (Meilisearch flat vs DB nested)
function resolveImageUrl(product: any): string {
  return (
    product.imageUrl ||
    product.images?.[0]?.url ||
    product.images?.[0]?.cdnUrl ||
    ''
  );
}

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const debouncedQuery = useDebounce(query, 300);
  const [selectedMall, setSelectedMall] = useState(searchParams.get('mall') || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('categoryId') || '');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const user = useAuthStore((s) => s.user);
  const isSeller = user ? ['STALL_OWNER', 'ATTENDANT'].includes(user.role) : false;

  useEffect(() => { setPage(1); }, [debouncedQuery, selectedCategoryId]);

  // Keep URL in sync so shares / back-button work
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (selectedCategoryId) params.set('categoryId', selectedCategoryId);
    if (selectedMall) params.set('mall', selectedMall);
    const qs = params.toString();
    router.replace(qs ? `/marketplace?${qs}` : '/marketplace', { scroll: false });
  }, [debouncedQuery, selectedCategoryId, selectedMall, router]);

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
    queryKey: ['search', debouncedQuery.trim(), selectedMall, selectedCategoryId, sortBy, page],
    queryFn: () =>
      api.get('/api/v1/search', {
        params: {
          q: debouncedQuery.trim() || undefined,
          mall: selectedMall || undefined,
          categoryId: selectedCategoryId || undefined,
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
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex-shrink-0"><Logo size={30} /></Link>
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
          {topCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-2 pb-1 -mx-1 px-1">
              <button
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
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 pb-safe">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100">
                <div className="bg-gray-100 rounded-xl h-48 mb-3" />
                <div className="bg-gray-100 rounded-lg h-4 mb-2 w-3/4" />
                <div className="bg-gray-100 rounded-lg h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-xl font-black text-navy-700">
                  {activeCategoryName
                    ? activeCategoryName
                    : debouncedQuery
                    ? `Results for "${debouncedQuery}"`
                    : 'Browse Products'}
                </h1>
                <p className="text-sm text-gray-500">{data?.total || 0} products</p>
              </div>
              {!isSeller && (
                <Link href="/demands/new" className="btn-bid text-sm py-2.5 px-4 flex items-center gap-2">
                  <Gavel className="w-4 h-4" /> Post Demand
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product: any) => {
                const imgUrl = resolveImageUrl(product);
                const stallName = product.stallName || product.stall?.name || 'Market Stall';
                const price = typeof product.minPrice === 'number'
                  ? product.minPrice
                  : parseFloat(product.minPrice);
                return (
                  <Link
                    key={product.id}
                    href={`/marketplace/${product.id}`}
                    className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-brand-blue hover:shadow-lg transition-all group"
                  >
                    <div className="bg-white h-48 flex items-center justify-center overflow-hidden relative border-b border-gray-50">
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={product.name}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                          className="object-contain p-2 group-hover:scale-105 transition-transform"
                          priority={product.trustScore >= 70}
                        />
                      ) : (
                        <ShoppingBag className="w-12 h-12 text-gray-200" />
                      )}
                      {product.trustScore >= 70 && (
                        <div className="absolute top-2 left-2 badge-success flex items-center gap-1">
                          <Star className="w-3 h-3" /> Trusted
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-bold text-sm text-navy-700 line-clamp-2 mb-1 group-hover:text-brand-blue transition-colors leading-tight">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                        <MapPin className="w-3 h-3 text-brand-orange flex-shrink-0" />
                        <span className="truncate">{stallName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black text-navy-700">
                          {formatCurrency(isNaN(price) ? 0 : price)}
                        </span>
                        <span className="text-xs font-semibold text-brand-green bg-green-50 px-2 py-0.5 rounded-lg">
                          Available
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
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
                    onClick={() => setSelectedCategoryId('')}
                    className="btn-secondary text-sm mr-3"
                  >
                    Clear category filter
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
