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

export type Mall = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  _count?: { stalls?: number };
};

export async function fetchMalls(city?: string): Promise<Mall[]> {
  const { data } = await api.get<Mall[]>('/api/v1/stalls/malls', {
    params: city ? { city } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

/** Fetches products filtered by mallId — used as a proxy for "products in this mall". */
export async function fetchMallProducts(
  mallId: string,
  page = 1,
  limit = 24,
): Promise<StallBrowseResponse> {
  const { data } = await api.get<StallBrowseResponse>('/api/v1/products/browse', {
    params: { mallId, page, limit, sortBy: 'newest' },
  });
  return data;
}

export type MerchantSelfSetup = {
  businessName: string;
  businessPhone?: string;
  stallName: string;
  stallNumber: string;
  mallId?: string;
  description?: string;
  address?: string;
  phone?: string;
};

export async function submitMerchantSetup(payload: MerchantSelfSetup) {
  const { data } = await api.post('/api/v1/merchants/me/setup', payload);
  return data;
}

export async function fetchMyMerchant(): Promise<{ id: string; businessName: string } | null> {
  try {
    const { data } = await api.get('/api/v1/merchants/me');
    return data;
  } catch {
    return null;
  }
}
