'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { Package, Plus, Search, ArrowLeft, AlertTriangle, Edit2, ToggleLeft, ToggleRight, Store, Zap, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';

export default function InventoryPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['STALL_OWNER', 'ATTENDANT'].includes(user.role)) { router.push('/dashboard'); return; }
  }, [authLoading, isAuthenticated, user, router]);

  const [stallId, setStallId] = useState('');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: merchant, isError: merchantError } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const { data: stalls } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: !!merchant?.id,
  });

  useEffect(() => {
    if (stalls?.length && !stallId) setStallId(stalls[0].id);
  }, [stalls, stallId]);

  const { data: productsRes, isLoading } = useQuery({
    queryKey: ['inventory-products', stallId],
    queryFn: () => api.get(`/api/v1/products/stall/${stallId}`, { params: { limit: 100 } }).then((r) => r.data),
    enabled: !!stallId,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ productId, stallId: sid, status }: { productId: string; stallId: string; status: string }) =>
      api.patch(`/api/v1/products/${productId}`, { stallId: sid, status }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Product updated');
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Update failed'),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ variantId, changeQty }: { variantId: string; changeQty: number }) =>
      api.post('/api/v1/inventory/adjust', { variantId, changeQty, reason: 'MANUAL_ADJUSTMENT' }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Stock updated');
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Update failed'),
  });

  const boostMutation = useMutation({
    mutationFn: ({ productId, days }: { productId: string; days: number }) =>
      api.post(`/api/v1/products/${productId}/boost`, { days }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Product boosted until ${new Date(data.promotedUntil).toLocaleDateString()} — $${data.fee.toFixed(2)} deducted`);
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Boost failed'),
  });

  const stallBoostMutation = useMutation({
    mutationFn: ({ sid, days }: { sid: string; days: number }) =>
      api.post(`/api/v1/stalls/${sid}/boost`, { days }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Stall featured until ${new Date(data.promotedUntil).toLocaleDateString()}`);
      queryClient.invalidateQueries({ queryKey: ['my-stalls'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Stall boost failed'),
  });


  const products: any[] = productsRes?.data || productsRes || [];
  const filtered = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products;

  const totalProducts = products.length;
  const lowStock = products.filter((p) =>
    p.variants?.some((v: any) => v.inventory && v.inventory.quantity <= (v.inventory.lowStockThreshold ?? 5)),
  ).length;
  const outOfStock = products.filter((p) =>
    p.variants?.every((v: any) => !v.inventory || v.inventory.quantity === 0),
  ).length;

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-navy-700" />
            </Link>
            <Logo size={30} />
            <div className="hidden sm:block">
              <h1 className="text-lg font-black text-navy-700">Stock Management</h1>
              <p className="text-xs text-gray-500">Manage your products and inventory</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/seller/branding"
              className="flex items-center gap-2 border-2 border-gray-100 text-navy-700 text-sm font-bold py-2.5 px-3 sm:px-4 rounded-xl hover:border-brand-green transition-colors"
              title="Store and stall logos"
            >
              <Store className="w-4 h-4" /> <span className="hidden sm:inline">Logos</span>
            </Link>
            <Link
              href={`/inventory/new${stallId ? `?stallId=${stallId}` : ''}`}
              className="flex items-center gap-2 bg-brand-green text-white text-sm font-bold py-2.5 px-4 rounded-xl hover:bg-green-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Product
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        {merchantError ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center px-6">
              <Store className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="font-black text-navy-700 text-lg mb-1">No Merchant Profile</p>
              <p className="text-sm text-gray-500 mb-4">You need to complete seller setup before managing inventory.</p>
              <Link href="/seller/setup" className="btn-primary inline-flex items-center gap-2">Go to Setup</Link>
            </div>
          </div>
        ) : (
        <>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 text-center">
            <p className="text-2xl font-black text-navy-700">{totalProducts}</p>
            <p className="text-xs text-gray-500 mt-1">Total Products</p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-amber-100 p-4 text-center">
            <p className="text-2xl font-black text-amber-500">{lowStock}</p>
            <p className="text-xs text-gray-500 mt-1">Low Stock</p>
          </div>
          <div className="bg-white rounded-2xl border-2 border-red-100 p-4 text-center">
            <p className="text-2xl font-black text-brand-red">{outOfStock}</p>
            <p className="text-xs text-gray-500 mt-1">Out of Stock</p>
          </div>
        </div>

        {/* Stall boost banner */}
        {stallId && (() => {
          const currentStall = (stalls as any[])?.find((s: any) => s.id === stallId);
          if (!currentStall) return null;
          const isStallPromoted = currentStall.isPromoted && currentStall.promotedUntil && new Date(currentStall.promotedUntil) > new Date();
          return (
            <div className={`rounded-2xl border-2 p-4 mb-4 flex items-center gap-4 flex-wrap ${isStallPromoted ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isStallPromoted ? 'bg-amber-100' : 'bg-gray-100'}`}>
                  <Zap className={`w-4 h-4 ${isStallPromoted ? 'text-amber-600' : 'text-gray-500'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-navy-700 truncate">{currentStall.name}</p>
                  {isStallPromoted ? (
                    <p className="text-xs text-amber-700 font-semibold">
                      <Star className="inline w-3 h-3 fill-amber-500 text-amber-500 mr-0.5" />
                      Featured until {new Date(currentStall.promotedUntil).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Boost stall to appear at the top of stall listings</p>
                  )}
                </div>
              </div>
              {!isStallPromoted && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([{ days: 7, price: 1 }, { days: 14, price: 2 }, { days: 30, price: 4 }] as const).map((tier) => (
                    <button
                      key={tier.days}
                      onClick={() => {
                        if (confirm(`Feature your stall "${currentStall.name}" for ${tier.days} days? $${tier.price} will be deducted from your wallet.`)) {
                          stallBoostMutation.mutate({ sid: stallId, days: tier.days });
                        }
                      }}
                      disabled={stallBoostMutation.isPending}
                      className="text-xs font-bold px-2.5 py-1.5 rounded-full border-2 border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
                    >
                      {tier.days}d · ${tier.price}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Search */}
        <div className="bg-white rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-green mb-4">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-3 bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none"
          />
        </div>

        {/* Product list */}
        {!stallId ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100 h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No products yet</p>
            <Link href={`/inventory/new?stallId=${stallId}`} className="mt-3 inline-flex items-center gap-2 text-brand-green font-bold text-sm hover:underline">
              <Plus className="w-4 h-4" /> Add your first product
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((product: any) => {
              const totalStock = product.variants?.reduce(
                (sum: number, v: any) => sum + (v.inventory?.quantity ?? 0), 0,
              ) ?? 0;
              const isLow = product.variants?.some(
                (v: any) => v.inventory && v.inventory.quantity > 0 && v.inventory.quantity <= (v.inventory.lowStockThreshold ?? 5),
              );
              const isOut = totalStock === 0;
              const isActive = product.status === 'ACTIVE';

              const primaryImage = product.images?.find((img: any) => img.isPrimary) || product.images?.[0];

              return (
                <div key={product.id} className="bg-white rounded-2xl border-2 border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    {primaryImage && (
                      <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-white border border-gray-100">
                        <img
                          src={primaryImage.cdnUrl || primaryImage.url}
                          alt={primaryImage.alt || product.name}
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-navy-700">{product.name}</span>
                        {product.brand && <span className="text-xs text-gray-400">{product.brand}</span>}
                        {product.category && (
                          <span className="text-xs bg-blue-50 text-brand-blue px-2 py-0.5 rounded-full font-medium">
                            {product.category.name}
                          </span>
                        )}
                        {isOut && (
                          <span className="text-xs bg-red-50 text-brand-red px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Out of stock
                          </span>
                        )}
                        {isLow && !isOut && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Low stock
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {product.variants?.length ?? 0} variant{product.variants?.length !== 1 ? 's' : ''} &middot; Total stock: <span className={`font-bold ${isOut ? 'text-brand-red' : isLow ? 'text-amber-600' : 'text-brand-green'}`}>{totalStock}</span>
                      </p>

                      {/* Variants */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.variants?.map((v: any) => (
                          <div key={v.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-xs">
                            <span className="font-semibold text-navy-700">{v.color || ''} {v.size || ''} {v.name !== 'Default' ? v.name : ''}</span>
                            <span className="text-gray-400">|</span>
                            <span className="font-bold text-brand-green">{formatCurrency(parseFloat(v.sellingPrice))}</span>
                            <span className="text-gray-400">|</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => (v.inventory?.quantity ?? 0) > 0 && adjustMutation.mutate({ variantId: v.id, changeQty: -1 })}
                                disabled={(v.inventory?.quantity ?? 0) === 0}
                                className="w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold leading-none disabled:opacity-40"
                              >−</button>
                              <span className={`w-7 text-center font-black ${(v.inventory?.quantity ?? 0) === 0 ? 'text-brand-red' : (v.inventory?.quantity ?? 0) <= 5 ? 'text-amber-600' : 'text-navy-700'}`}>
                                {v.inventory?.quantity ?? 0}
                              </span>
                              <button
                                onClick={() => adjustMutation.mutate({ variantId: v.id, changeQty: 1 })}
                                className="w-5 h-5 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold leading-none"
                              >+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/inventory/new?stallId=${stallId}&editId=${product.id}`}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                        title="Edit product"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </Link>
                      <button
                        onClick={() => toggleMutation.mutate({ productId: product.id, stallId, status: isActive ? 'INACTIVE' : 'ACTIVE' })}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                        title={isActive ? 'Deactivate' : 'Activate'}
                      >
                        {isActive
                          ? <ToggleRight className="w-5 h-5 text-brand-green" />
                          : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Boost row */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                    {product.isPromoted && product.promotedUntil && new Date(product.promotedUntil) > new Date() ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        Featured until {new Date(product.promotedUntil).toLocaleDateString()}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Zap className="w-3.5 h-3.5" />
                          <span className="font-semibold">Boost:</span>
                        </div>
                        {([{ days: 7, price: 1 }, { days: 14, price: 2 }, { days: 30, price: 4 }] as const).map((tier) => (
                          <button
                            key={tier.days}
                            onClick={() => {
                              if (confirm(`Boost "${product.name}" for ${tier.days} days? $${tier.price.toFixed(2)} will be deducted from your wallet.`)) {
                                boostMutation.mutate({ productId: product.id, days: tier.days });
                              }
                            }}
                            disabled={boostMutation.isPending}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-full border-2 border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
                          >
                            {tier.days}d · ${tier.price}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
