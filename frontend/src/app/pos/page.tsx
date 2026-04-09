'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Minus, Trash2, Store, Receipt, MapPin, Package, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useCartStore, useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import FeatureGate from '@/components/FeatureGate';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { generateIdempotencyKey } from '@/lib/idempotency';

const PAYMENT_METHODS = [
  { value: 'CASH',     label: 'Cash' },
  { value: 'ECOCASH',  label: 'EcoCash' },
  { value: 'ONEMONEY', label: 'OneMoney' },
  { value: 'CARD',     label: 'Card' },
];

export default function POSPage() {
  const [stallId, setStallId] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const cart = useCartStore();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: merchant, isError: merchantError } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data),
  });

  const { data: stalls } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: !!merchant?.id,
  });

  const { data: products, isLoading: loadingProducts, isFetching: fetchingProducts } = useQuery({
    queryKey: ['stall-products', stallId, debouncedSearch],
    queryFn: () => api.get(`/api/v1/products/stall/${stallId}`, { params: { search: debouncedSearch.trim() || undefined } }).then((r) => r.data),
    enabled: !!stallId,
    placeholderData: (prev: any) => prev,
    staleTime: 60_000,
  });

  const saleMutation = useMutation({
    mutationFn: (saleData: any) => api.post('/api/v1/pos/sales', saleData).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Sale #${data.receiptNumber} completed!`);
      setLastSaleId(data.id ?? data.saleId ?? null);
      cart.clearCart();
      queryClient.invalidateQueries({ queryKey: ['stall-products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Sale failed'),
  });

  // Auto-select first stall on load — guard against re-render clearing cart
  useEffect(() => {
    if (!stallId && stalls?.length) {
      const first = stalls[0].id;
      setStallId(first);
      if (cart.stallId !== first) cart.setStall(first);
    }
  }, [stalls, stallId]);

  // Warn before leaving with items in cart
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (cart.items.length > 0 || saleMutation.isPending) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [cart.items.length, saleMutation.isPending]);

  const handleSelectStall = (id: string) => {
    setStallId(id);
    cart.setStall(id);
  };

  const handleCheckout = () => {
    if (cart.items.length === 0) { toast.error('Cart is empty'); return; }
    const key = generateIdempotencyKey();
    saleMutation.mutate({
      stallId,
      cashierId: user?.id,
      paymentMethod,
      items: cart.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      _idempotencyKey: key,
    });
  };

  return (
    <FeatureGate>
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex-shrink-0"><Logo size={30} /></Link>
            <div className="hidden sm:block">
              <h1 className="text-lg font-black text-navy-700">Point of Sale</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
            <MapPin className="w-4 h-4 text-brand-green flex-shrink-0" />
            <span className="text-sm font-bold text-navy-700">
              {stalls?.find((s: any) => s.id === stallId)?.name ?? 'Loading stall...'}
            </span>
          </div>
        </div>
      </header>

      {merchantError ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center px-6">
            <Store className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="font-black text-navy-700 text-lg mb-1">No Merchant Profile</p>
            <p className="text-sm text-gray-500 mb-4">You need to complete seller setup before using the POS.</p>
            <Link href="/seller/setup" className="btn-primary inline-flex items-center gap-2">Go to Setup</Link>
          </div>
        </div>
      ) : !stallId ? (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Loading your stall...</p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-4 pb-safe grid lg:grid-cols-3 gap-4">
          {/* Products */}
          <div className="lg:col-span-2">
            <div className="relative mb-4">
              <div className="bg-white rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-green focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input type="text" placeholder="Search products by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full py-3 bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none font-medium" />
                {(debouncedSearch !== search || fetchingProducts) && (
                  <Loader2 className="w-4 h-4 text-brand-green animate-spin flex-shrink-0" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {loadingProducts ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100"><div className="bg-gray-100 h-20 rounded-xl mb-2" /><div className="bg-gray-100 h-4 rounded-lg w-3/4" /></div>
                ))
              ) : (
                (products?.data || products || []).flatMap((p: any) => (
                  (p.variants || []).map((v: any) => {
                    const outOfStock = !v.inventory || v.inventory.quantity === 0;
                    return (
                      <button
                        key={v.id}
                        onClick={() => cart.addItem({ variantId: v.id, productName: p.name, variantName: `${v.color || ''} ${v.size || ''}`.trim() || 'Default', price: parseFloat(v.sellingPrice), maxStock: v.inventory?.quantity || 0 })}
                        className={`bg-white rounded-2xl border-2 p-4 text-left transition-all ${outOfStock ? 'border-gray-100 opacity-50 cursor-not-allowed' : 'border-gray-100 hover:border-brand-green hover:shadow-md active:scale-[0.98]'}`}
                        disabled={outOfStock}
                      >
                        <div className="font-bold text-sm text-navy-700 line-clamp-1">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{v.color} {v.size}</div>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-lg font-black text-navy-700">{formatCurrency(parseFloat(v.sellingPrice))}</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${outOfStock ? 'bg-red-50 text-brand-red' : 'bg-green-50 text-brand-green'}`}>
                            {outOfStock ? 'Out' : `${v.inventory?.quantity}`}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ))
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 lg:sticky lg:top-20 lg:self-start overflow-hidden">
            <div className="bg-navy-700 text-white px-5 py-4 flex items-center justify-between">
              <h2 className="font-black text-lg">Cart</h2>
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{cart.getItemCount()} items</span>
            </div>

            <div className="p-5">
              {cart.items.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Tap products to add to cart</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[45vh] overflow-y-auto">
                  {cart.items.map((item) => (
                    <div key={item.variantId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-navy-700 truncate">{item.productName}</div>
                        <div className="text-xs text-gray-500">{item.variantName} &middot; {formatCurrency(item.price)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => cart.updateQuantity(item.variantId, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-black text-navy-700">{item.quantity}</span>
                        <button onClick={() => cart.updateQuantity(item.variantId, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button onClick={() => cart.removeItem(item.variantId)} className="w-7 h-7 flex items-center justify-center hover:bg-red-100 rounded-lg text-brand-red ml-1 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-gray-100 mt-4 pt-4 pb-20 lg:pb-0">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-500">Total</span>
                  <span className="text-2xl font-black text-navy-700">{formatCurrency(cart.getTotal())}</span>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPaymentMethod(m.value)}
                        className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${paymentMethod === m.value ? 'border-brand-green bg-green-50 text-brand-green' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                {lastSaleId && (
                  <Link href={`/receipts/${lastSaleId}`} className="flex items-center justify-center gap-2 w-full py-2.5 mb-2 rounded-xl border-2 border-brand-green text-brand-green text-sm font-bold hover:bg-green-50 transition-colors">
                    <Receipt className="w-4 h-4" /> View Last Receipt
                  </Link>
                )}
                <button onClick={handleCheckout} disabled={cart.items.length === 0 || saleMutation.isPending} className="btn-bid w-full text-center flex items-center justify-center gap-2 py-4 text-base">
                  <Receipt className="w-5 h-5" />
                  {saleMutation.isPending ? 'Processing...' : 'Complete Sale'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
