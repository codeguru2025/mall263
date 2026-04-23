import { api } from '@/lib/api';

/** Flat hit from `GET /api/v1/search` (Meilisearch or DB fallback — same shape per backend). */
export type SearchHit = {
  id: string;
  name: string;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  city?: string;
  imageUrl?: string;
};

export type SearchResponse = {
  data: SearchHit[];
  total: number;
  page: number;
  limit: number;
  query?: string;
  processingTimeMs?: number;
};

export async function fetchSearchPage(
  q: string,
  page: number,
  limit = 20,
  filters?: {
    categoryId?: string;
    mallId?: string;
    city?: string;
    nearLat?: number;
    nearLng?: number;
    radiusKm?: number;
  },
): Promise<SearchResponse> {
  const params: Record<string, unknown> = { q, page, limit };
  if (filters?.categoryId) params.categoryId = filters.categoryId;
  if (filters?.mallId) params.mallId = filters.mallId;
  if (filters?.city) params.city = filters.city;
  if (filters?.nearLat != null) params.nearLat = filters.nearLat;
  if (filters?.nearLng != null) params.nearLng = filters.nearLng;
  if (filters?.radiusKm != null) params.radiusKm = filters.radiusKm;
  const { data } = await api.get<SearchResponse>('/api/v1/search', { params });
  return data;
}
