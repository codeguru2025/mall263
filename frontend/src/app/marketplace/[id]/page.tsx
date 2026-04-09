'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { ArrowLeft, MapPin, Star, Package, Gavel, ShoppingBag, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/api/v1/products/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
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

  const primaryImage = product.images?.find((img: any) => img.isPrimary) ?? product.images?.[0];
  const activeVariant = product.variants?.find((v: any) => v.id === selectedVariant) ?? product.variants?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/marketplace" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
        </div>
      </header>

      <div className="max-w-2xl mx-auto">
        {/* Product image */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 h-72 flex items-center justify-center relative overflow-hidden">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <ShoppingBag className="w-20 h-20 text-gray-300" />
          )}
          {product.trustScore >= 70 && (
            <div className="absolute top-4 left-4 badge-success flex items-center gap-1"><Star className="w-3 h-3" /> Trusted Seller</div>
          )}
        </div>

        <div className="px-4 pt-6 pb-28 sm:pb-6 space-y-5">
          {/* Name & price */}
          <div>
            <h1 className="text-2xl font-black text-navy-700 leading-tight mb-1">{product.name}</h1>
            {product.brand && <p className="text-sm text-gray-500 mb-3">{product.brand}</p>}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-navy-700">
                {formatCurrency(activeVariant?.sellingPrice ?? product.minPrice)}
              </span>
              {product.minPrice !== product.maxPrice && (
                <span className="text-sm text-gray-400">– {formatCurrency(product.maxPrice)}</span>
              )}
            </div>
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
              activeVariant.inventory?.quantity > 0
                ? 'bg-green-50 text-brand-green'
                : 'bg-red-50 text-brand-red'
            }`}>
              <Package className="w-4 h-4" />
              {activeVariant.inventory?.quantity > 0
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
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-brand-orange" />
                </div>
                <div>
                  <p className="font-bold text-navy-700">{product.stall.name}</p>
                  {product.stall.stallNumber && (
                    <p className="text-sm text-gray-500">Stall {product.stall.stallNumber}</p>
                  )}
                  {product.stall.mall && (
                    <p className="text-sm text-gray-500">{product.stall.mall.name}, {product.stall.mall.city}</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-3 bg-gray-50 rounded-xl px-4 py-3">
                Visit this stall to purchase. Pay the seller directly in person.
              </p>
            </div>
          )}

          {/* Post demand CTA */}
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-5 border-2 border-orange-100">
            <p className="font-bold text-navy-700 mb-1">Can&apos;t find exactly what you need?</p>
            <p className="text-sm text-gray-600 mb-4">Post a demand and let sellers come to you with their best offers.</p>
            <Link href="/demands/new" className="btn-bid text-sm py-2.5 px-5 flex items-center gap-2 w-fit">
              <Gavel className="w-4 h-4" /> Post a Demand
            </Link>
          </div>

          {/* Bottom nav spacer — keeps last content above the fixed nav on mobile */}
          <div className="h-20 sm:hidden" />
        </div>
      </div>
    </div>
  );
}
