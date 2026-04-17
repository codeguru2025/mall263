import { api } from '@/lib/api';

export type BrowseProductImage = { url: string; alt?: string | null };
export type BrowseProduct = {
  id: string;
  name: string;
  slug: string;
  minPrice: unknown;
  maxPrice: unknown;
  currency?: string;
  images: BrowseProductImage[];
  category?: { name: string; slug: string } | null;
  stall?: {
    name: string;
    mall?: { name: string; city: string } | null;
  } | null;
};

export type BrowseResponse = {
  data: BrowseProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function fetchBrowsePage(page: number, limit = 20): Promise<BrowseResponse> {
  const { data } = await api.get<BrowseResponse>('/api/v1/products/browse', {
    params: { page, limit },
  });
  return data;
}

export function formatMoney(value: unknown, currency = 'USD'): string {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (Number.isFinite(n)) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  }
  return String(value);
}
