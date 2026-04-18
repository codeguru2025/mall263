import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mall263:wishlist';

export type WishlistItem = {
  id: string;
  name: string;
  minPrice: unknown;
  maxPrice: unknown;
  currency: string;
  imageUrl?: string | null;
  savedAt: number;
};

async function load(): Promise<WishlistItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function save(items: WishlistItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function getWishlist(): Promise<WishlistItem[]> {
  const items = await load();
  return items.sort((a, b) => b.savedAt - a.savedAt);
}

export async function isWishlisted(id: string): Promise<boolean> {
  const items = await load();
  return items.some((i) => i.id === id);
}

export async function addToWishlist(item: Omit<WishlistItem, 'savedAt'>): Promise<void> {
  const items = await load();
  if (items.some((i) => i.id === item.id)) return;
  items.push({ ...item, savedAt: Date.now() });
  await save(items);
}

export async function removeFromWishlist(id: string): Promise<void> {
  const items = await load();
  await save(items.filter((i) => i.id !== id));
}

export async function toggleWishlist(item: Omit<WishlistItem, 'savedAt'>): Promise<boolean> {
  const items = await load();
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items.splice(idx, 1);
    await save(items);
    return false;
  }
  items.push({ ...item, savedAt: Date.now() });
  await save(items);
  return true;
}
