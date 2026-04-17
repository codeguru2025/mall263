import { api } from '@/lib/api';

export type SubscriptionPlan = {
  id: string;
  name: string;
  code?: string;
  price: unknown;
  currency?: string;
  billingPeriod?: string;
  features?: string[];
  description?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
};

export type SubscriptionStatus = {
  status?: string;
  tier?: string | null;
  isActive?: boolean;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  plan?: SubscriptionPlan | null;
  ecocashNumber?: string | null;
  [key: string]: unknown;
};

export type PromoValidation = {
  valid: boolean;
  discount?: number;
  months?: number;
  message?: string;
  [key: string]: unknown;
};

export type PayInitiation = {
  reference?: string;
  redirectUrl?: string;
  instructions?: string;
  status?: string;
  [key: string]: unknown;
};

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const { data } = await api.get('/api/v1/subscriptions/plans');
  return Array.isArray(data) ? data : [];
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const { data } = await api.get<SubscriptionStatus>('/api/v1/subscriptions/status');
  return data;
}

export async function validatePromoCode(code: string): Promise<PromoValidation> {
  const { data } = await api.get<PromoValidation>('/api/v1/subscriptions/promo/validate', {
    params: { code },
  });
  return data;
}

export async function initiateSubscriptionPayment(promoCode?: string): Promise<PayInitiation> {
  const { data } = await api.post<PayInitiation>('/api/v1/subscriptions/pay', {
    promoCode: promoCode?.trim() || undefined,
  });
  return data;
}

export async function pollSubscriptionPayment(reference: string): Promise<{
  status?: string;
  paid?: boolean;
  [key: string]: unknown;
}> {
  const { data } = await api.get(`/api/v1/subscriptions/poll/${reference}`);
  return data;
}
