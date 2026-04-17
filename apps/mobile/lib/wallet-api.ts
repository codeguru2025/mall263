import { api } from '@/lib/api';

export type WalletBalance = {
  available: unknown;
  locked: unknown;
  total?: unknown;
  currency: string;
};

export type WalletTxRow = {
  id: string;
  type: string;
  amount: unknown;
  description?: string | null;
  status: string;
  createdAt: string;
};

export type WalletTransactionsPage = {
  data: WalletTxRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function fetchWalletBalance(): Promise<WalletBalance> {
  const { data } = await api.get<WalletBalance>('/api/v1/wallets/me/balance');
  return data;
}

export async function fetchWalletTransactionsPage(page: number, limit = 25): Promise<WalletTransactionsPage> {
  const { data } = await api.get<WalletTransactionsPage>('/api/v1/wallets/me/transactions', {
    params: { page, limit },
  });
  return data;
}

export async function requestWalletWithdrawal(
  amount: number,
  description?: string,
): Promise<WalletTxRow> {
  const body: Record<string, unknown> = { amount };
  if (description?.trim()) body.description = description.trim();
  const { data } = await api.post<WalletTxRow>('/api/v1/wallets/me/withdraw', body);
  return data;
}
