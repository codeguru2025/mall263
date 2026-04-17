import { api } from '@/lib/api';

export type DemandListItem = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  urgency: string;
  maxBudget: unknown;
  minBudget?: unknown;
  currency: string;
  createdAt: string;
  expiresAt?: string;
  offers?: Array<{ id: string; totalPrice: unknown; status: string }>;
};

export type DemandOfferDetail = {
  id: string;
  totalPrice: unknown;
  status: string;
  createdAt?: string;
  expiresAt?: string;
  message?: string | null;
  stall?: { id: string; name: string; stallNumber?: string | null } | null;
  items?: Array<{
    quantity: number;
    price: unknown;
    variant?: { product?: { name?: string } | null } | null;
  }>;
};

export type DemandDetail = Omit<DemandListItem, 'offers'> & {
  buyer?: { id: string; firstName?: string; lastName?: string } | null;
  offers?: DemandOfferDetail[];
};

export async function fetchMyDemands(status?: string): Promise<DemandListItem[]> {
  const params = status ? { status } : {};
  const { data } = await api.get<DemandListItem[]>('/api/v1/demands/my', { params });
  return data;
}

export async function fetchDemandById(id: string): Promise<DemandDetail> {
  const { data } = await api.get<DemandDetail>(`/api/v1/demands/${id}`);
  return data;
}

export async function createDemand(body: {
  title: string;
  description?: string;
  maxBudget: number;
  minBudget?: number;
  urgency?: string;
  expiresInHours?: number;
}): Promise<DemandListItem> {
  const { data } = await api.post<DemandListItem>('/api/v1/demands', body);
  return data;
}

export async function acceptOffer(offerId: string): Promise<{ accepted?: boolean; feeCharged?: number }> {
  const { data } = await api.post<{ accepted?: boolean; feeCharged?: number }>(
    `/api/v1/demands/offers/${offerId}/accept`,
  );
  return data;
}

export type OpenDemandRow = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  urgency: string;
  maxBudget: unknown;
  minBudget?: unknown;
  currency: string;
  createdAt: string;
  expiresAt?: string;
};

export type OpenDemandsPage = {
  data: OpenDemandRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function fetchOpenDemandsPage(page: number, limit: number): Promise<OpenDemandsPage> {
  const { data } = await api.get<OpenDemandsPage>('/api/v1/demands/open', { params: { page, limit } });
  return data;
}

export async function submitSellerOffer(
  demandId: string,
  body: {
    stallId: string;
    message?: string;
    totalPrice: number;
    items: Array<{ variantId: string; quantity: number; price: number }>;
    expiresInHours?: number;
  },
): Promise<unknown> {
  const { data } = await api.post(`/api/v1/demands/${demandId}/offers`, body);
  return data;
}
