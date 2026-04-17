import { api } from '@/lib/api';

export type DashboardStats = {
  totalUsers: number;
  activeStalls: number;
  totalRevenue: unknown;
  pendingStalls: number;
  totalProducts: number;
  totalSales: number;
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
