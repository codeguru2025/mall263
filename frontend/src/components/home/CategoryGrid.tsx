'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Smartphone, Shirt, Apple, Sofa, Dumbbell, Car, LayoutGrid,
  Scissors, Sparkles, Watch, Gem, Briefcase, Monitor, Wrench,
  BookOpen, Baby, Pill, Leaf, Utensils, ShoppingBag, Footprints,
  Bike, Paintbrush, Plug, Camera, Music, Dog, Hammer,
  Package, Wheat, Coffee, Wine,
} from 'lucide-react';
import api from '@/lib/api';
import type { LucideIcon } from 'lucide-react';

interface CategoryStyle { icon: LucideIcon; color: string; bg: string }

const CATEGORY_MAP: Array<{ keys: string[]; style: CategoryStyle }> = [
  { keys: ['nail', 'manicure', 'pedicure'],          style: { icon: Sparkles,   color: 'text-pink-600',   bg: 'bg-pink-50'   } },
  { keys: ['beauty', 'cosmetic', 'makeup', 'lipstick', 'skincare', 'lotion', 'cream', 'perfume', 'cologne'], style: { icon: Sparkles, color: 'text-rose-500', bg: 'bg-rose-50' } },
  { keys: ['hair', 'wig', 'weave', 'barber', 'salon'], style: { icon: Scissors,  color: 'text-purple-600', bg: 'bg-purple-50' } },
  { keys: ['fashion', 'cloth', 'dress', 'shirt', 'trouser', 'pant', 'skirt', 'wear', 'outfit', 'apparel', 'suit'], style: { icon: Shirt, color: 'text-blue-500', bg: 'bg-blue-50' } },
  { keys: ['shoe', 'boot', 'sandal', 'heel', 'sneaker', 'trainer', 'footwear'], style: { icon: Footprints, color: 'text-amber-600', bg: 'bg-amber-50' } },
  { keys: ['bag', 'handbag', 'purse', 'backpack', 'luggage', 'suitcase'], style: { icon: Briefcase,  color: 'text-yellow-600', bg: 'bg-yellow-50' } },
  { keys: ['jewel', 'jewellery', 'jewelry', 'ring', 'necklace', 'bracelet', 'earring', 'gold', 'silver'], style: { icon: Gem, color: 'text-yellow-500', bg: 'bg-yellow-50' } },
  { keys: ['watch', 'clock', 'timepiece'],            style: { icon: Watch,      color: 'text-gray-700',   bg: 'bg-gray-100'  } },
  { keys: ['phone', 'mobile', 'smartphone', 'tablet', 'iphone', 'samsung', 'tecno', 'infinix'], style: { icon: Smartphone, color: 'text-sky-600', bg: 'bg-sky-50' } },
  { keys: ['computer', 'laptop', 'pc', 'desktop', 'monitor', 'keyboard', 'mouse'], style: { icon: Monitor, color: 'text-indigo-600', bg: 'bg-indigo-50' } },
  { keys: ['electronic', 'gadget', 'tech', 'tv', 'television', 'speaker', 'earphone', 'headphone'], style: { icon: Plug, color: 'text-violet-600', bg: 'bg-violet-50' } },
  { keys: ['camera', 'photo', 'photography', 'video'],style: { icon: Camera,    color: 'text-orange-600', bg: 'bg-orange-50' } },
  { keys: ['food', 'groceri', 'fruit', 'vegetable', 'snack', 'confection'], style: { icon: Apple, color: 'text-green-600', bg: 'bg-green-50' } },
  { keys: ['meat', 'chicken', 'beef', 'pork', 'fish', 'seafood'], style: { icon: Utensils, color: 'text-red-500', bg: 'bg-red-50' } },
  { keys: ['grain', 'maize', 'mealie', 'flour', 'wheat', 'rice', 'farm', 'agri'], style: { icon: Wheat, color: 'text-yellow-700', bg: 'bg-yellow-50' } },
  { keys: ['drink', 'beverage', 'juice', 'water', 'soda', 'soft drink'], style: { icon: Coffee, color: 'text-teal-600', bg: 'bg-teal-50' } },
  { keys: ['alcohol', 'beer', 'wine', 'spirit', 'liquor'], style: { icon: Wine, color: 'text-red-700', bg: 'bg-red-50' } },
  { keys: ['furniture', 'sofa', 'table', 'chair', 'bed', 'mattress', 'cupboard', 'wardrobe'], style: { icon: Sofa, color: 'text-emerald-700', bg: 'bg-emerald-50' } },
  { keys: ['home', 'kitchen', 'decor', 'household', 'appliance', 'curtain', 'carpet', 'tile'], style: { icon: Sofa, color: 'text-teal-600', bg: 'bg-teal-50' } },
  { keys: ['sport', 'fitness', 'gym', 'exercise', 'athletic', 'football', 'soccer', 'cricket', 'tennis', 'rugby'], style: { icon: Dumbbell, color: 'text-orange-500', bg: 'bg-orange-50' } },
  { keys: ['bicycle', 'bike', 'cycling'],             style: { icon: Bike,      color: 'text-lime-600',   bg: 'bg-lime-50'   } },
  { keys: ['tool', 'hardware', 'plumb', 'electric', 'build', 'construct', 'cement', 'brick', 'paint'], style: { icon: Hammer, color: 'text-slate-600', bg: 'bg-slate-50' } },
  { keys: ['car', 'auto', 'vehicle', 'truck', 'bus', 'spare part', 'tyre', 'oil'], style: { icon: Car, color: 'text-gray-700', bg: 'bg-gray-100' } },
  { keys: ['health', 'medicine', 'pharmacy', 'medical', 'drug', 'supplement', 'vitamin'], style: { icon: Pill, color: 'text-red-500', bg: 'bg-red-50' } },
  { keys: ['plant', 'garden', 'seed', 'flower', 'nursery', 'tree', 'grass'], style: { icon: Leaf, color: 'text-green-500', bg: 'bg-green-50' } },
  { keys: ['baby', 'infant', 'kid', 'child', 'toy', 'diaper', 'stroller'], style: { icon: Baby, color: 'text-pink-400', bg: 'bg-pink-50' } },
  { keys: ['book', 'stationery', 'pen', 'notebook', 'school', 'office supply'], style: { icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' } },
  { keys: ['music', 'instrument', 'guitar', 'drum', 'piano', 'audio'], style: { icon: Music, color: 'text-purple-500', bg: 'bg-purple-50' } },
  { keys: ['art', 'craft', 'paint', 'draw', 'canvas', 'fabric'],           style: { icon: Paintbrush, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' } },
  { keys: ['pet', 'dog', 'cat', 'animal', 'veterinary', 'bird'],           style: { icon: Dog,       color: 'text-amber-600',  bg: 'bg-amber-50'  } },
];

const DEFAULT_STYLE: CategoryStyle = { icon: Package, color: 'text-gray-500', bg: 'bg-gray-100' };

function getCategoryStyle(name: string): CategoryStyle {
  const lower = name.toLowerCase();
  for (const { keys, style } of CATEGORY_MAP) {
    if (keys.some((k) => lower.includes(k))) return style;
  }
  return DEFAULT_STYLE;
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
    .slice(0, 10);

  if (topLevel.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {/* All */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelectCategory(null)}
          className={`flex-shrink-0 flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 min-w-[64px] transition-all ${
            !selectedCategoryId
              ? 'bg-orange-50 border-brand-orange'
              : 'bg-white border-gray-100 hover:border-gray-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!selectedCategoryId ? 'bg-brand-orange' : 'bg-gray-100'}`}>
            <LayoutGrid className={`w-5 h-5 ${!selectedCategoryId ? 'text-white' : 'text-gray-500'}`} />
          </div>
          <span className={`text-[10px] font-bold leading-tight ${!selectedCategoryId ? 'text-brand-orange' : 'text-gray-500'}`}>All</span>
        </motion.button>

        {topLevel.map((cat) => {
          const { icon: Icon, color, bg } = getCategoryStyle(cat.name);
          const active = selectedCategoryId === cat.id;
          return (
            <motion.button
              key={cat.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectCategory(active ? null : cat.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 min-w-[64px] transition-all ${
                active
                  ? 'bg-orange-50 border-brand-orange'
                  : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-brand-orange' : bg}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-white' : color}`} />
              </div>
              <span className={`text-[10px] font-bold leading-tight text-center line-clamp-1 w-full ${active ? 'text-brand-orange' : 'text-gray-600'}`}>
                {cat.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
