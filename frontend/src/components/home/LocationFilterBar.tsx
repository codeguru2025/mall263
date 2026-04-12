'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, MapPin } from 'lucide-react';
import api from '@/lib/api';

interface Mall {
  id: string;
  name: string;
  city: string;
}

interface Props {
  selectedMallId: string | null;
  onSelectMall: (id: string | null) => void;
}

export default function LocationFilterBar({ selectedMallId, onSelectMall }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const { data: malls = [] } = useQuery<Mall[]>({
    queryKey: ['malls'],
    queryFn: () => api.get('/api/v1/stalls/malls').then((r) => r.data),
    staleTime: 300_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(searchQuery.trim() ? `/marketplace?q=${encodeURIComponent(searchQuery)}` : '/marketplace');
  };

  return (
    <div className="sticky top-[calc(57px+env(safe-area-inset-top,0px))] z-40 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Search bar */}
        <form onSubmit={handleSearch} className="mb-3">
          <div className="bg-gray-50 rounded-xl flex items-center gap-3 px-4 border-2 border-gray-100 focus-within:border-brand-orange focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search products, brands, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2.5 bg-transparent text-sm text-navy-700 placeholder-gray-400 outline-none font-medium"
            />
          </div>
        </form>

        {/* Mall filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectMall(null)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              !selectedMallId
                ? 'bg-brand-orange text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <MapPin className="w-3 h-3" /> All Markets
          </motion.button>
          {malls.map((mall) => (
            <motion.button
              key={mall.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectMall(selectedMallId === mall.id ? null : mall.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                selectedMallId === mall.id
                  ? 'bg-brand-orange text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mall.name}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
