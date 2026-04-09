'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Smartphone, Shirt, Apple, Heart, Sofa, Phone, Dumbbell, Car, Tag, LayoutGrid } from 'lucide-react';
import api from '@/lib/api';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  electronics: Smartphone,
  fashion: Shirt,
  clothing: Shirt,
  food: Apple,
  groceries: Apple,
  health: Heart,
  beauty: Heart,
  home: Sofa,
  furniture: Sofa,
  phones: Phone,
  accessories: Phone,
  sports: Dumbbell,
  auto: Car,
  automotive: Car,
};

function getIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (lower.includes(key)) return icon;
  }
  return Tag;
}

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  isActive?: boolean;
}

interface Props {
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
}

export default function CategoryGrid({ selectedCategoryId, onSelectCategory }: Props) {
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/products/categories').then((r) => r.data),
    staleTime: 300_000,
  });

  const topLevel = categories
    .filter((c) => !c.parentId && c.isActive !== false)
    .slice(0, 8);

  if (topLevel.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-9 gap-2">
        {/* All option */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelectCategory(null)}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
            !selectedCategoryId
              ? 'bg-orange-50 border-brand-orange text-brand-orange'
              : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
          }`}
        >
          <LayoutGrid className="w-6 h-6" />
          <span className="text-[10px] font-bold leading-tight">All</span>
        </motion.button>

        {topLevel.map((cat) => {
          const Icon = getIcon(cat.name);
          const active = selectedCategoryId === cat.id;
          return (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectCategory(active ? null : cat.id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                active
                  ? 'bg-orange-50 border-brand-orange text-brand-orange'
                  : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-bold leading-tight line-clamp-1">{cat.name}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
