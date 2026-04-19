import { api } from '@/lib/api';

export type MobileMethod = 'ecocash' | 'onemoney' | 'telecash' | 'omari';

export type InitiateMobileResult = {
  reference: string;
  pollUrl: string;
  instructions: string;
};

export type InitiateWebResult = {
  reference: string;
  redirectUrl: string;
  pollUrl: string;
};

export type PaymentStatus = {
  paid: boolean;
  status: string;
};

export async function initiateMobilePayment(
  amount: number,
  phone: string,
  method: MobileMethod,
): Promise<InitiateMobileResult> {
  const { data } = await api.post<InitiateMobileResult>('/api/v1/payments/initiate/mobile', {
    amount,
    phone,
    method,
  });
  return data;
}

export async function initiateWebPayment(amount: number): Promise<InitiateWebResult> {
  const { data } = await api.post<InitiateWebResult>('/api/v1/payments/initiate/web', { amount });
  return data;
}

export async function pollPaymentStatus(reference: string): Promise<PaymentStatus> {
  const { data } = await api.get<PaymentStatus>(`/api/v1/payments/status/${reference}`);
  return data;
}
