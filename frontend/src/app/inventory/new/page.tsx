'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Logo } from '@/components/Logo';
import { ImageUpload, UploadedImage } from '@/components/ImageUpload';
import { ArrowLeft, Plus, Trash2, Package } from 'lucide-react';
import toast from 'react-hot-toast';

interface Variant {
  name: string;
  color: string;
  size: string;
  sku: string;
  costPrice: string;
  sellingPrice: string;
  stockQuantity: string;
}

const emptyVariant = (): Variant => ({
  name: 'Default',
  color: '',
  size: '',
  sku: '',
  costPrice: '',
  sellingPrice: '',
  stockQuantity: '',
});

export default function NewProductPage() {
  const router = useRouter();
  const params = useSearchParams();
  const stallId = params.get('stallId') || '';

  const [form, setForm] = useState({
    name: '',
    description: '',
    brand: '',
    categoryId: '',
  });
  const [variants, setVariants] = useState<Variant[]>([emptyVariant()]);
  const [images, setImages] = useState<UploadedImage[]>([]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data),
  });

  const { data: merchant } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data),
  });

  const { data: stalls } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: !!merchant?.id,
  });

  const [selectedStall, setSelectedStall] = useState(stallId);
  useEffect(() => {
    if (!selectedStall && stalls?.length) setSelectedStall(stalls[0].id);
  }, [stalls, selectedStall]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/api/v1/products', {
        stallId: selectedStall,
        name: form.name,
        description: form.description || undefined,
        brand: form.brand || undefined,
        categoryId: form.categoryId || undefined,
        variants: variants.map((v) => ({
          name: v.name || 'Default',
          color: v.color || undefined,
          size: v.size || undefined,
          sku: v.sku || undefined,
          costPrice: parseFloat(v.costPrice),
          sellingPrice: parseFloat(v.sellingPrice),
          stockQuantity: parseInt(v.stockQuantity, 10),
        })),
        images: images.length > 0 ? images.map((img, idx) => ({
          url: img.cdnUrl || img.url,
          alt: img.alt || form.name,
          isPrimary: img.isPrimary || idx === 0,
        })) : undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Product added to stock!');
      router.push(`/inventory${selectedStall ? `?stallId=${selectedStall}` : ''}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add product'),
  });

  const updateVariant = (index: number, key: keyof Variant, value: string) => {
    setVariants((vs) => vs.map((v, i) => (i === index ? { ...v, [key]: value } : v)));
  };

  const addVariant = () => setVariants((vs) => [...vs, emptyVariant()]);
  const removeVariant = (index: number) => setVariants((vs) => vs.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStall) { toast.error('Select a stall first'); return; }
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const sell = parseFloat(v.sellingPrice);
      const cost = parseFloat(v.costPrice);
      const qty = parseInt(v.stockQuantity, 10);
      if (!v.sellingPrice || isNaN(sell) || sell <= 0) {
        toast.error(`Variant ${i + 1}: selling price must be greater than 0`); return;
      }
      if (!v.costPrice || isNaN(cost) || cost < 0) {
        toast.error(`Variant ${i + 1}: cost price must be 0 or greater`); return;
      }
      if (!v.stockQuantity || isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
        toast.error(`Variant ${i + 1}: stock quantity must be a whole number ≥ 0`); return;
      }
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/inventory${stallId ? `?stallId=${stallId}` : ''}`} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Add Product</h1>
            <p className="text-xs text-gray-500">Add new stock to your stall</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 pb-28 sm:pb-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Stall indicator */}
          {stalls?.find((s: any) => s.id === selectedStall) && (
            <div className="bg-green-50 rounded-2xl border-2 border-green-100 px-5 py-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-green flex-shrink-0" />
              <span className="text-sm font-bold text-navy-700">
                Adding to: {stalls.find((s: any) => s.id === selectedStall)?.name}
              </span>
            </div>
          )}

          {/* Product details */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-brand-green" />
              </div>
              <h2 className="font-black text-navy-700">Product Details</h2>
            </div>

            <div>
              <label className="label">Product Name <span className="text-brand-red">*</span></label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Lobels Brown Bread / Nike Air Max 90"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Brand</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Lobels / Nike / Dairibord"
                  value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">Select category</option>
                  {(categories || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Short product description..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          {/* Product Images */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
            <ImageUpload
              images={images}
              onChange={setImages}
              maxImages={5}
            />
          </div>

          {/* Variants */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-navy-700">Variants & Stock</h2>
              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-1.5 text-sm text-brand-green font-bold hover:underline"
              >
                <Plus className="w-4 h-4" /> Add variant
              </button>
            </div>

            <div className="space-y-4">
              {variants.map((v, i) => (
                <div key={i} className="border-2 border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-500">Variant {i + 1}</span>
                    {variants.length > 1 && (
                      <button type="button" onClick={() => removeVariant(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-brand-red transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Colour</label>
                      <input type="text" className="input" placeholder="e.g. Black" value={v.color} onChange={(e) => updateVariant(i, 'color', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Size</label>
                      <input type="text" className="input" placeholder="e.g. 42 / L / XL" value={v.size} onChange={(e) => updateVariant(i, 'size', e.target.value)} />
                    </div>
                  </div>

                  <div>
                    <label className="label">SKU / Barcode</label>
                    <input type="text" className="input" placeholder="Optional" value={v.sku} onChange={(e) => updateVariant(i, 'sku', e.target.value)} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Cost ($) <span className="text-brand-red">*</span></label>
                      <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={v.costPrice} onChange={(e) => updateVariant(i, 'costPrice', e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Sell ($) <span className="text-brand-red">*</span></label>
                      <input type="number" className="input" placeholder="0.00" min="0" step="0.01" value={v.sellingPrice} onChange={(e) => updateVariant(i, 'sellingPrice', e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Qty <span className="text-brand-red">*</span></label>
                      <input type="number" className="input" placeholder="0" min="0" step="1" value={v.stockQuantity} onChange={(e) => updateVariant(i, 'stockQuantity', e.target.value)} required />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
          >
            <Package className="w-5 h-5" />
            {mutation.isPending ? 'Adding...' : 'Add to Stock'}
          </button>
        </form>
      </div>
    </div>
  );
}
