'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { MapPin, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  minPrice: string;
  maxPrice?: string;
  imageUrl?: string;
  images?: { url: string }[];
  stallName?: string;
  stall?: { name: string; mall?: { name: string } };
}

interface Props {
  product: Product;
  priority?: boolean;
}

export default function ProductCard({ product, priority = false }: Props) {
  const imageUrl = product.imageUrl || (product.images?.[0] as any)?.cdnUrl || product.images?.[0]?.url;
  const stallName = product.stallName || product.stall?.mall?.name || product.stall?.name || 'Market Stall';

  return (
    <motion.div whileTap={{ scale: 0.98 }}>
      <Link
        href={`/marketplace/${product.id}`}
        className="block bg-white rounded-2xl border-2 border-gray-100 overflow-hidden hover:border-brand-orange hover:shadow-md transition-all group"
      >
        <div className="relative aspect-square bg-white overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <ShoppingBag className="w-10 h-10 text-gray-200" />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-bold text-xs sm:text-sm text-navy-700 line-clamp-2 mb-1 group-hover:text-brand-orange transition-colors leading-tight">
            {product.name}
          </h3>
          {(() => {
            const p = parseFloat(product.minPrice);
            return isFinite(p) && p > 0 ? (
              <p className="text-sm sm:text-base font-black text-brand-orange mb-1">
                {formatCurrency(p)}
              </p>
            ) : null;
          })()}
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <MapPin className="w-2.5 h-2.5" />
            <span className="truncate">{stallName}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
