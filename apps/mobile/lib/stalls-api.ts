import { api } from '@/lib/api';

export type StallRow = {
  id: string;
  name: string;
  stallNumber?: string | null;
  mall?: { name: string; city: string } | null;
};

export type StallDetail = {
  id: string;
  name: string;
  description?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  stallNumber?: string | null;
  viewCount?: number;
  followerCount?: number;
  mall?: {
    id: string;
    name: string;
    city?: string | null;
    address?: string | null;
  } | null;
  merchant?: {
    id: string;
    businessName?: string | null;
    logoUrl?: string | null;
    user?: { firstName?: string; lastName?: string; phone?: string } | null;
  } | null;
  _count?: { products?: number; posSales?: number };
};

export type StallProductBrowseItem = {
  id: string;
  name: string;
  slug?: string;
  minPrice: unknown;
  maxPrice: unknown;
  currency?: string;
  images?: { url: string; alt?: string | null }[];
  category?: { name: string; slug?: string } | null;
};

export type StallBrowseResponse = {
  data: StallProductBrowseItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function fetchStallsByMerchant(merchantId: string): Promise<StallRow[]> {
  const { data } = await api.get<StallRow[]>(`/api/v1/stalls/merchant/${merchantId}`);
  return Array.isArray(data) ? data : [];
}

export async function fetchStallById(stallId: string): Promise<StallDetail> {
  const { data } = await api.get<StallDetail>(`/api/v1/stalls/${stallId}`);
  return data;
}

export async function fetchStallBrowsePage(
  stallId: string,
  page: number,
  limit = 24,
): Promise<StallBrowseResponse> {
  const { data } = await api.get<StallBrowseResponse>('/api/v1/products/browse', {
    params: { stallId, page, limit, sortBy: 'newest' },
  });
  return data;
}

export async function recordStallVisit(stallId: string): Promise<void> {
  try {
    await api.post(`/api/v1/stalls/${stallId}/visit`);
  } catch {
    // Visit counter failures must never disrupt the store page UX.
  }
}
