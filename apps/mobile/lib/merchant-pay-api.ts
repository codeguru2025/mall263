import { api } from './api';

export interface MerchantPayCart {
  stallId: string;
  items: { variantId: string; quantity: number; discount?: number }[];
  paymentMethod: 'ECOCASH' | 'ONEMONEY';
  discountAmount?: number;
  discountType?: string;
  customerPhone: string;
  notes?: string;
}

export interface MerchantPayInitResult {
  reference: string;
  totalAmount: number;
  merchantCode: string;
  network: 'ECOCASH' | 'ONEMONEY';
}

export interface MerchantPayPollResult {
  paid: boolean;
  status: string;
  sale: any | null;
}

export interface StallPaymentConfig {
  ecocashMerchantCode: string | null;
  onemoneyMerchantCode: string | null;
}

export async function initiateMerchantPayment(
  cart: MerchantPayCart,
): Promise<MerchantPayInitResult> {
  const res = await api.post('/api/v1/pos/merchant-payment/initiate', cart);
  return res.data;
}

export async function pollMerchantPayment(reference: string): Promise<MerchantPayPollResult> {
  const res = await api.get(`/api/v1/pos/merchant-payment/poll/${reference}`);
  return res.data;
}

export async function fetchPaymentConfig(stallId: string): Promise<StallPaymentConfig> {
  const res = await api.get(`/api/v1/stalls/${stallId}/payment-config`);
  return res.data;
}

export async function savePaymentConfig(
  stallId: string,
  config: Partial<StallPaymentConfig>,
): Promise<StallPaymentConfig> {
  const res = await api.patch(`/api/v1/stalls/${stallId}/payment-config`, config);
  return res.data;
}
