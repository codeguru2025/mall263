'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, ShoppingBag } from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  minPrice: string;
  maxPrice: string;
  images: { url: string }[];
  stall: { name: string; mall: { name: string; city: string } };
}

export default function BannerCarousel() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['featured-products'],
    queryFn: () => api.get('/api/v1/products/browse?limit=6&sortBy=popular').then((r) => r.data.data || []),
    staleTime: 120_000,
  });

  const slides = products.slice(0, 6);

  const advance = useCallback((dir: number) => {
    if (slides.length === 0) return;
    setDirection(dir);
    setIndex((i) => (i + dir + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-rotate
  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = setInterval(() => advance(1), 5000);
    return () => clearInterval(timer);
  }, [slides.length, paused, advance]);

  // Pause on tab hidden
  useEffect(() => {
    const handler = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  if (slides.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="aspect-[2/1] sm:aspect-[3/1] bg-gradient-to-br from-navy-700 to-navy-900 rounded-2xl flex items-center justify-center">
          <div className="text-center text-white/40">
            <ShoppingBag className="w-10 h-10 mx-auto mb-2" />
            <p className="text-sm font-medium">Featured products coming soon</p>
          </div>
        </div>
      </div>
    );
  }

  const slide = slides[index];

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -300 : 300, opacity: 0 }),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-3">
      <div
        className="relative aspect-[2/1] sm:aspect-[3/1] rounded-2xl overflow-hidden bg-navy-800 cursor-pointer"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={slide.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 50) {
                advance(info.offset.x > 0 ? -1 : 1);
              }
            }}
            className="absolute inset-0"
          >
            <Link href={`/marketplace/${slide.id}`} className="block w-full h-full">
              {slide.images[0] ? (
                <Image
                  src={slide.images[0].url}
                  alt={slide.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 1280px"
                  priority={index === 0}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-brand-orange/20 to-brand-green/20 flex items-center justify-center">
                  <ShoppingBag className="w-16 h-16 text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                <div className="text-white/70 text-xs mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {slide.stall?.mall?.name || slide.stall?.name}
                </div>
                <h3 className="text-white font-black text-base sm:text-xl line-clamp-1 mb-1">{slide.name}</h3>
                <div className="text-brand-green font-black text-lg sm:text-2xl">
                  {formatCurrency(parseFloat(slide.minPrice))}
                </div>
              </div>
            </Link>
          </motion.div>
        </AnimatePresence>

        {/* Dots */}
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'bg-white w-5' : 'bg-white/40 w-1.5'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
