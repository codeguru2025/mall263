import { api } from '@/lib/api';

export type StallProductRow = {
  id: string;
  name: string;
  variants: Array<{
    id: string;
    name: string;
    sellingPrice: unknown;
    inventory?: { quantity: number; reservedQty?: number } | null;
  }>;
};

export type StallProductsPage = {
  data: StallProductRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function fetchStallProductsPage(
  stallId: string,
  page: number,
  limit = 25,
): Promise<StallProductsPage> {
  const { data } = await api.get<StallProductsPage>(`/api/v1/products/stall/${stallId}`, {
    params: { page, limit },
  });
  return data;
}
