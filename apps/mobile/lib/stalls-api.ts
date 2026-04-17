import { api } from '@/lib/api';

export type StallRow = {
  id: string;
  name: string;
  stallNumber?: string | null;
  mall?: { name: string; city: string } | null;
};

export async function fetchStallsByMerchant(merchantId: string): Promise<StallRow[]> {
  const { data } = await api.get<StallRow[]>(`/api/v1/stalls/merchant/${merchantId}`);
  return Array.isArray(data) ? data : [];
}
