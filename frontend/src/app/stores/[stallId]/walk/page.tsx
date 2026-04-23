'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Play, ChevronRight, ShoppingBag, Layers } from 'lucide-react';

interface Hotspot {
  id: string;
  timestamp: number;
  xCoord: number;
  yCoord: number;
  product: {
    id: string;
    name: string;
    slug: string | null;
    minPrice: number | string | null;
    maxPrice: number | string | null;
    currency: string;
    images: { cdnUrl?: string; url?: string }[];
  };
}

interface ShelfVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  hotspots: Hotspot[];
}

interface Shelf {
  shelfLayer: string;
  video: ShelfVideo;
}

interface AisleGroup {
  aisleName: string;
  shelves: Shelf[];
}

function HotspotPin({ hotspot, onClick }: { hotspot: Hotspot; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ left: `${hotspot.xCoord * 100}%`, top: `${hotspot.yCoord * 100}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group"
      aria-label={`View ${hotspot.product.name}`}
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-orange border-2 border-white shadow-lg animate-pulse group-hover:scale-110 transition-transform">
        <ShoppingBag className="w-4 h-4 text-white" />
      </span>
    </button>
  );
}

function VideoPlayer({ video, onHotspotClick }: { video: ShelfVideo; onHotspotClick: (h: Hotspot) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  // Show hotspots within ±2s of their timestamp
  const visibleHotspots = video.hotspots.filter(
    (h) => Math.abs(h.timestamp - currentTime) <= 2,
  );

  function handleHotspot(h: Hotspot) {
    setActiveHotspot(h);
    onHotspotClick(h);
  }

  return (
    <div className="relative w-full bg-black rounded-2xl overflow-hidden">
      <video
        ref={videoRef}
        src={video.videoUrl}
        controls
        playsInline
        className="w-full max-h-[60vh] object-contain"
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
        poster={video.thumbnailUrl ?? undefined}
      />
      {/* Hotspot overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="relative w-full h-full pointer-events-auto">
          {visibleHotspots.map((h) => (
            <HotspotPin key={h.id} hotspot={h} onClick={() => handleHotspot(h)} />
          ))}
        </div>
      </div>
      {/* Active hotspot product card */}
      {activeHotspot && (
        <div className="absolute bottom-16 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl p-3 shadow-xl border border-gray-100 flex items-center gap-3">
          {activeHotspot.product.images[0] && (
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              <Image
                src={activeHotspot.product.images[0].cdnUrl || activeHotspot.product.images[0].url || ''}
                alt=""
                fill
                className="object-contain"
                sizes="48px"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-navy-700 line-clamp-1">{activeHotspot.product.name}</p>
            {activeHotspot.product.minPrice && (
              <p className="text-xs text-brand-orange font-bold">
                {formatCurrency(parseFloat(String(activeHotspot.product.minPrice)))}
              </p>
            )}
          </div>
          <Link
            href={`/marketplace/${activeHotspot.product.id}`}
            className="flex-shrink-0 text-xs font-bold text-white bg-brand-blue rounded-xl px-3 py-1.5"
          >
            View
          </Link>
          <button
            onClick={() => setActiveHotspot(null)}
            className="flex-shrink-0 text-gray-400 text-sm px-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default function VirtualWalkPage() {
  const { stallId } = useParams<{ stallId: string }>();
  const [selectedAisle, setSelectedAisle] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);
  const [productPanel, setProductPanel] = useState<Hotspot | null>(null);

  const { data: aisles, isLoading, isError } = useQuery<AisleGroup[]>({
    queryKey: ['virtual-walk', stallId],
    queryFn: () => api.get(`/api/v1/virtual-walk/shop/${stallId}`).then((r) => r.data),
    enabled: !!stallId,
  });

  const { data: stall } = useQuery({
    queryKey: ['stall-name', stallId],
    queryFn: () => api.get(`/api/v1/stalls/${stallId}`).then((r) => r.data),
    enabled: !!stallId,
  });

  useEffect(() => {
    if (aisles?.length && !selectedAisle) {
      setSelectedAisle(aisles[0].aisleName);
      setSelectedShelf(aisles[0].shelves[0]?.shelfLayer ?? null);
    }
  }, [aisles, selectedAisle]);

  const currentAisle = aisles?.find((a) => a.aisleName === selectedAisle);
  const currentShelf = currentAisle?.shelves.find((s) => s.shelfLayer === selectedShelf);

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link href={`/stores/${stallId}`} className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm truncate">{stall?.name ?? 'Virtual Walk'}</p>
          <p className="text-xs text-gray-400">Explore the store in 360°</p>
        </div>
      </header>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="text-center py-20 px-4">
          <p className="text-gray-400 mb-2">Virtual walk not available for this store.</p>
          <Link href={`/stores/${stallId}`} className="text-brand-orange text-sm font-bold">
            Back to store
          </Link>
        </div>
      )}

      {!isLoading && !isError && (!aisles || aisles.length === 0) && (
        <div className="text-center py-20 px-4">
          <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold mb-1">No virtual walk yet</p>
          <p className="text-gray-600 text-sm mb-4">This store hasn&apos;t uploaded any walk videos yet.</p>
          <Link href={`/stores/${stallId}`} className="text-brand-orange text-sm font-bold">
            Browse products instead
          </Link>
        </div>
      )}

      {aisles && aisles.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Aisle selector */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {aisles.map((a) => (
              <button
                key={a.aisleName}
                onClick={() => {
                  setSelectedAisle(a.aisleName);
                  setSelectedShelf(a.shelves[0]?.shelfLayer ?? null);
                }}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  selectedAisle === a.aisleName
                    ? 'bg-brand-orange text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {a.aisleName}
              </button>
            ))}
          </div>

          {/* Shelf selector within aisle */}
          {currentAisle && currentAisle.shelves.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {currentAisle.shelves.map((s) => (
                <button
                  key={s.shelfLayer}
                  onClick={() => setSelectedShelf(s.shelfLayer)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedShelf === s.shelfLayer
                      ? 'bg-white text-gray-900'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Shelf {s.shelfLayer}
                </button>
              ))}
            </div>
          )}

          {/* Video player */}
          {currentShelf ? (
            <VideoPlayer video={currentShelf.video} onHotspotClick={setProductPanel} />
          ) : (
            <div className="aspect-video bg-gray-800 rounded-2xl flex items-center justify-center">
              <Play className="w-12 h-12 text-gray-600" />
            </div>
          )}

          {/* Hotspot product list */}
          {currentShelf && currentShelf.video.hotspots.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Products in this view
              </p>
              <div className="space-y-2">
                {currentShelf.video.hotspots.map((h) => {
                  const img = h.product.images[0]?.cdnUrl || h.product.images[0]?.url;
                  const price = h.product.minPrice ? parseFloat(String(h.product.minPrice)) : null;
                  return (
                    <Link
                      key={h.id}
                      href={`/marketplace/${h.product.id}`}
                      className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-xl p-3 transition-colors"
                    >
                      {img ? (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                          <Image src={img} alt="" fill className="object-contain" sizes="40px" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-5 h-5 text-gray-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{h.product.name}</p>
                        {price && isFinite(price) && price > 0 && (
                          <p className="text-xs text-brand-orange font-bold">{formatCurrency(price)}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aisle overview / navigation between shelves */}
          <div className="bg-gray-800 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              All sections in this store
            </p>
            <div className="space-y-1">
              {aisles.map((a) => (
                <div key={a.aisleName}>
                  {a.shelves.map((s) => {
                    const isActive = a.aisleName === selectedAisle && s.shelfLayer === selectedShelf;
                    return (
                      <button
                        key={s.video.id}
                        onClick={() => { setSelectedAisle(a.aisleName); setSelectedShelf(s.shelfLayer); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${
                          isActive ? 'bg-brand-orange/20 text-brand-orange font-bold' : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {s.video.thumbnailUrl ? (
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                            <Image src={s.video.thumbnailUrl} alt="" fill className="object-cover" sizes="32px" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <Play className="w-3 h-3 text-gray-500" />
                          </div>
                        )}
                        <span className="truncate">{a.aisleName} — Shelf {s.shelfLayer}</span>
                        {s.video.hotspots.length > 0 && (
                          <span className="ml-auto text-xs bg-brand-orange/30 text-brand-orange rounded-full px-2 py-0.5">
                            {s.video.hotspots.length} items
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
