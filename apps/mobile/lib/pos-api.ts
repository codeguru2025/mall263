import { api } from '@/lib/api';

export type PaymentMethod = 'CASH' | 'ECOCASH' | 'WALLET' | 'INNBUCKS' | 'BANK_TRANSFER' | 'MIXED';

export type POSSaleItem = {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: unknown;
  discount: unknown;
  totalPrice: unknown;
};

export type POSSale = {
  id: string;
  receiptNumber?: string | null;
  totalAmount: unknown;
  discountAmount?: unknown;
  paymentMethod: PaymentMethod;
  status: string;
  customerPhone?: string | null;
  notes?: string | null;
  createdAt: string;
  items?: POSSaleItem[];
  cashier?: { firstName: string; lastName: string } | null;
};

export type POSSalesPage = {
  data: POSSale[];
  total: number;
  page: number;
  totalPages: number;
};

export type DailySummary = {
  totalSales: number;
  totalRevenue: unknown;
  totalTransactions: number;
  date: string;
};

export async function processSale(body: {
  stallId: string;
  items: Array<{ variantId: string; quantity: number; discount?: number }>;
  paymentMethod: PaymentMethod;
  discountAmount?: number;
  customerPhone?: string;
  notes?: string;
}): Promise<POSSale> {
  const { data } = await api.post<POSSale>('/api/v1/pos/sales', body);
  return data;
}

export async function fetchSalesByStall(
  stallId: string,
  page = 1,
  limit = 20,
): Promise<POSSalesPage> {
  const { data } = await api.get<POSSalesPage>(`/api/v1/pos/sales/stall/${stallId}`, {
    params: { page, limit },
  });
  return data;
}

export async function fetchSaleById(id: string): Promise<POSSale> {
  const { data } = await api.get<POSSale>(`/api/v1/pos/sales/${id}`);
  return data;
}

export async function fetchDailySummary(stallId: string): Promise<DailySummary> {
  const { data } = await api.get<DailySummary>(`/api/v1/pos/summary/stall/${stallId}`);
  return data;
}
