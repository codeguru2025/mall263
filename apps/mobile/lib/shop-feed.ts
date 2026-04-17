import { fetchBrowsePage, type BrowseProduct } from '@/lib/products';
import { fetchSearchPage, type SearchHit } from '@/lib/search';

export { formatMoney } from '@/lib/products';

export type ShopListItem = {
  id: string;
  name: string;
  minPrice: unknown;
  maxPrice: unknown;
  currency?: string;
  imageUrl: string | null;
  subtitle: string | null;
};

function fromBrowse(p: BrowseProduct): ShopListItem {
  const imageUrl = p.images?.[0]?.url ?? null;
  const subtitle = [p.category?.name, p.stall?.mall?.city].filter(Boolean).join(' · ') || null;
  return {
    id: p.id,
    name: p.name,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    currency: p.currency,
    imageUrl,
    subtitle,
  };
}

function fromSearchHit(h: SearchHit): ShopListItem {
  const subtitle = [h.category, h.city].filter(Boolean).join(' · ') || null;
  return {
    id: h.id,
    name: h.name,
    minPrice: h.minPrice,
    maxPrice: h.maxPrice,
    imageUrl: h.imageUrl || null,
    subtitle,
  };
}

export type ShopFeedPage = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  rows: ShopListItem[];
};

export async function fetchShopFeedPage(searchQuery: string, page: number, limit = 20): Promise<ShopFeedPage> {
  const q = searchQuery.trim();
  if (!q) {
    const b = await fetchBrowsePage(page, limit);
    return {
      page: b.page,
      limit: b.limit,
      total: b.total,
      totalPages: b.totalPages,
      rows: b.data.map(fromBrowse),
    };
  }
  const s = await fetchSearchPage(q, page, limit);
  const totalPages = Math.max(1, Math.ceil(s.total / s.limit));
  return {
    page: s.page,
    limit: s.limit,
    total: s.total,
    totalPages,
    rows: s.data.map(fromSearchHit),
  };
}
