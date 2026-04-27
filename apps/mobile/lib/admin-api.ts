import { api } from '@/lib/api';

/** Matches `GET /api/v1/admin/dashboard` (backend getDashboardStats). */
export type DashboardStats = {
  users: number;
  merchants: number;
  stalls: number;
  products: number;
  sales: number;
  openDemands: number;
  totalCommissionRevenue: unknown;
};

export type AdminUser = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
};

export type AdminUsersPage = {
  data: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
};

export type AdminStall = {
  id: string;
  name: string;
  stallNumber?: string | null;
  status: string;
  createdAt: string;
  merchant?: { businessName: string; user?: { phone: string } } | null;
};

export type AdminStallsPage = {
  data: AdminStall[];
  total: number;
  page: number;
  totalPages: number;
};

export type AdminSubscription = {
  id: string;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  user: { id: string; phone: string; firstName: string; lastName: string };
  plan?: { name: string; priceUsd: unknown } | null;
};

export type AdminSubscriptionsPage = {
  data: AdminSubscription[];
  total: number;
  page: number;
  totalPages: number;
};

export async function fetchDashboard(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/api/v1/admin/dashboard');
  return data;
}

export async function fetchAdminUsers(search: string, page = 1): Promise<AdminUsersPage> {
  const { data } = await api.get<AdminUsersPage>('/api/v1/admin/users', {
    params: { search: search || undefined, page, limit: 20 },
  });
  return data;
}

export async function suspendUser(id: string): Promise<void> {
  await api.patch(`/api/v1/admin/users/${id}/suspend`);
}

export async function activateUser(id: string): Promise<void> {
  await api.patch(`/api/v1/admin/users/${id}/activate`);
}

export async function fetchAdminStalls(search: string, page = 1): Promise<AdminStallsPage> {
  const { data } = await api.get<AdminStallsPage>('/api/v1/admin/stalls', {
    params: { search: search || undefined, page, limit: 20 },
  });
  return data;
}

export async function approveStall(id: string): Promise<void> {
  await api.patch(`/api/v1/admin/stalls/${id}/approve`);
}

export async function suspendStall(id: string): Promise<void> {
  await api.patch(`/api/v1/admin/stalls/${id}/suspend`);
}

export async function activateStall(id: string): Promise<void> {
  await api.patch(`/api/v1/admin/stalls/${id}/activate`);
}

export async function adminUpdateStallLocation(stallId: string, latitude: number, longitude: number): Promise<void> {
  await api.patch(`/api/v1/admin/stalls/${stallId}/location`, { latitude, longitude });
}

export async function fetchAdminSubscriptions(page = 1): Promise<AdminSubscriptionsPage> {
  const { data } = await api.get<AdminSubscriptionsPage>('/api/v1/admin/subscriptions', {
    params: { page, limit: 20 },
  });
  return data;
}

export async function extendTrial(userId: string, days: number): Promise<void> {
  await api.patch(`/api/v1/admin/subscriptions/${userId}/extend-trial`, { days });
}

export async function grantFreeMonth(userId: string): Promise<void> {
  await api.patch(`/api/v1/admin/subscriptions/${userId}/grant-month`);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function fetchAdminSettings(): Promise<Record<string, string>> {
  const { data } = await api.get<Record<string, string>>('/api/v1/admin/settings');
  return data;
}

export async function saveAdminSetting(key: string, value: string): Promise<void> {
  await api.post(`/api/v1/admin/settings/${key}`, { value });
}

// ── Merchants ─────────────────────────────────────────────────────────────────

export type AdminMerchant = {
  id: string;
  businessName: string;
  status: string;
  createdAt: string;
  user?: { phone: string; firstName: string; lastName: string } | null;
};

export async function fetchAdminMerchants(search: string, page = 1) {
  const { data } = await api.get<{ data: AdminMerchant[]; total: number; page: number; totalPages: number }>(
    '/api/v1/merchants', { params: { search: search || undefined, page, limit: 20 } }
  );
  return data;
}

export async function verifyMerchant(id: string): Promise<void> { await api.patch(`/api/v1/merchants/${id}/verify`); }
export async function suspendMerchant(id: string): Promise<void> { await api.patch(`/api/v1/merchants/${id}/suspend`); }
export async function activateMerchant(id: string): Promise<void> { await api.patch(`/api/v1/merchants/${id}/activate`); }

// ── Drivers ───────────────────────────────────────────────────────────────────

export type AdminDriver = {
  id: string;
  tier: string;
  kycStatus: string;
  totalEarnings: unknown;
  floatBalance: unknown;
  isActive: boolean;
  user?: { firstName: string; lastName: string; phone: string } | null;
};

export async function fetchAdminDrivers(): Promise<AdminDriver[]> {
  const { data } = await api.get<AdminDriver[]>('/api/v1/drivers');
  return data;
}

export async function approveDriverKyc(id: string): Promise<void> { await api.patch(`/api/v1/drivers/${id}/kyc-approve`); }
export async function setDriverTier(id: string, tier: string): Promise<void> { await api.patch(`/api/v1/drivers/${id}/tier`, { tier }); }

// ── Promotions ────────────────────────────────────────────────────────────────

export type AdminPromotion = {
  id: string;
  code: string;
  type: 'REFERRAL' | 'COUPON' | 'DISCOUNT';
  discountPct: string | null;
  discountAmt: string | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  description: string | null;
};

export async function fetchAdminPromotions(): Promise<AdminPromotion[]> {
  const { data } = await api.get<AdminPromotion[]>('/api/v1/admin/promotions');
  return data;
}

export async function createPromotion(body: Partial<AdminPromotion> & { validFrom: string }): Promise<AdminPromotion> {
  const { data } = await api.post<AdminPromotion>('/api/v1/admin/promotions', body);
  return data;
}

export async function togglePromotion(id: string, isActive: boolean): Promise<void> {
  await api.patch(`/api/v1/admin/promotions/${id}`, { isActive });
}

export async function deletePromotion(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/promotions/${id}`);
}

// ── Ads ───────────────────────────────────────────────────────────────────────

export type AdminAd = {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  placement: string;
  targetRole: string | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  impressions: number;
};

export async function fetchAdminAds(): Promise<AdminAd[]> {
  const { data } = await api.get<AdminAd[]>('/api/v1/admin/ads');
  return data;
}

export async function createAd(body: Omit<AdminAd, 'id' | 'impressions'>): Promise<AdminAd> {
  const { data } = await api.post<AdminAd>('/api/v1/admin/ads', body);
  return data;
}

export async function toggleAd(id: string, isActive: boolean): Promise<void> {
  await api.patch(`/api/v1/admin/ads/${id}`, { isActive });
}

export async function deleteAd(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/ads/${id}`);
}
