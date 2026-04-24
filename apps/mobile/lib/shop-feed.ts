import { api } from '@/lib/api';
import { fetchBrowsePage, type BrowseProduct } from '@/lib/products';
import { fetchSearchPage, type SearchHit } from '@/lib/search';
import { displayCity } from '@/lib/stalls-api';

export { formatMoney } from '@/lib/products';

export type AdItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  placement: string;
};

export async function fetchActiveAd(placement = 'BANNER_TOP'): Promise<AdItem | null> {
  try {
    const { data } = await api.get<AdItem>('/api/v1/ads/active', { params: { placement } });
    return data ?? null;
  } catch {
    return null;
  }
}

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
  const subtitle =
    [p.category?.name, displayCity(p.stall?.mall?.city)].filter(Boolean).join(' · ') || null;
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

export async function fetchShopFeedPage(
  searchQuery: string,
  page: number,
  limit = 20,
  filters?: {
    categoryId?: string;
    mallId?: string;
    nearLat?: number;
    nearLng?: number;
    radiusKm?: number;
  },
): Promise<ShopFeedPage> {
  const q = searchQuery.trim();
  const params: Record<string, unknown> = { page, limit };
  if (filters?.categoryId) params.categoryId = filters.categoryId;
  if (filters?.mallId) params.mallId = filters.mallId;
  if (filters?.nearLat != null) params.nearLat = filters.nearLat;
  if (filters?.nearLng != null) params.nearLng = filters.nearLng;
  if (filters?.radiusKm != null) params.radiusKm = filters.radiusKm;

  // When no query: use /products/browse (grid feed with category/mall/geo filters).
  // When there's a query: use /search (which supports the same filters + geo server-side).
  if (!q) {
    const { data: b } = await api.get<{
      data: BrowseProduct[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/api/v1/products/browse', { params });
    return {
      page: b.page,
      limit: b.limit,
      total: b.total,
      totalPages: b.totalPages,
      rows: b.data.map(fromBrowse),
    };
  }
  const s = await fetchSearchPage(q, page, limit, {
    categoryId: filters?.categoryId,
    mallId: filters?.mallId,
    nearLat: filters?.nearLat,
    nearLng: filters?.nearLng,
    radiusKm: filters?.radiusKm,
  });
  const totalPages = Math.max(1, Math.ceil(s.total / s.limit));
  return {
    page: s.page,
    limit: s.limit,
    total: s.total,
    totalPages,
    rows: s.data.map(fromSearchHit),
  };
}
