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

export async function fetchSearchPage(q: string, page: number, limit = 20): Promise<SearchResponse> {
  const { data } = await api.get<SearchResponse>('/api/v1/search', {
    params: { q, page, limit },
  });
  return data;
}
