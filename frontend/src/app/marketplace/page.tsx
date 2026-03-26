'use client';

import Link from 'next/link';
import { Search, MapPin, Star, Gavel, SlidersHorizontal, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';

export default function MarketplacePage() {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['search', query, sortBy, page],
    queryFn: () => api.get('/search', { params: { q: query, sortBy, page, limit: 20 } }).then((r) => r.data),
    placeholderData: (prev: any) => prev,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex-shrink-0"><Logo size={30} /></Link>
            <div className="flex-1 relative">
              <div className="bg-gray-50 rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-blue focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search products, brands, categories..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  className="w-full py-2.5 bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none font-medium"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border-2 border-gray-100 rounded-xl py-2.5 px-3 text-sm bg-white font-semibold text-navy-700 focus:border-brand-blue outline-none">
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low</option>
                <option value="price_desc">Price: High</option>
                <option value="popular">Popular</option>
                <option value="trust">Trusted</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
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
                <h1 className="text-xl font-black text-navy-700">Browse Products</h1>
                <p className="text-sm text-gray-500">{data?.total || 0} products available</p>
              </div>
              <Link href="/demands/new" className="btn-bid text-sm py-2.5 px-5 flex items-center gap-2">
                <Gavel className="w-4 h-4" /> Post a Demand
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(data?.data || []).map((product: any) => (
                <Link key={product.id} href={`/marketplace/${product.id}`} className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-brand-blue hover:shadow-lg transition-all group">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 h-48 flex items-center justify-center overflow-hidden relative">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <ShoppingBag className="w-12 h-12 text-gray-300" />
                    )}
                    {product.trustScore >= 70 && (
                      <div className="absolute top-2 left-2 badge-success flex items-center gap-1"><Star className="w-3 h-3" /> Trusted</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-sm text-navy-700 line-clamp-2 mb-1.5 group-hover:text-brand-blue transition-colors">{product.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                      <MapPin className="w-3 h-3 text-brand-orange" />
                      <span>{product.stallName || 'Market Stall'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-navy-700">{formatCurrency(product.minPrice)}</span>
                      <span className="text-xs font-semibold text-brand-green bg-green-50 px-2 py-1 rounded-lg">Available</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {(data?.data || []).length === 0 && (
              <div className="text-center py-20">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-black text-navy-700 mb-2">No products found</h3>
                <p className="text-gray-500 mb-6">Try a different search or post a demand for what you need</p>
                <Link href="/demands/new" className="btn-primary">Post a Demand Instead</Link>
              </div>
            )}

            {data?.total > 20 && (
              <div className="flex justify-center mt-8 gap-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40">
                  Previous
                </button>
                <span className="py-2.5 px-4 text-sm font-bold text-navy-700 bg-white rounded-xl border-2 border-gray-100">Page {page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={(data?.data || []).length < 20} className="btn-secondary text-sm py-2.5 px-5 disabled:opacity-40">
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
