import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mall263:recently_viewed';
const MAX = 50;

export type RecentlyViewedItem = {
  id: string;
  name: string;
  minPrice: unknown;
  maxPrice: unknown;
  currency: string;
  imageUrl?: string | null;
  viewedAt: number;
};

async function load(): Promise<RecentlyViewedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordView(item: Omit<RecentlyViewedItem, 'viewedAt'>): Promise<void> {
  const items = await load();
  const filtered = items.filter((i) => i.id !== item.id);
  filtered.unshift({ ...item, viewedAt: Date.now() });
  await AsyncStorage.setItem(KEY, JSON.stringify(filtered.slice(0, MAX)));
}

export async function getRecentlyViewed(): Promise<RecentlyViewedItem[]> {
  return load();
}

export async function clearRecentlyViewed(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
