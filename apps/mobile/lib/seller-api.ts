import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/token-storage';
import { getApiBaseUrl } from '@/lib/config';

export type Stall = {
  id: string;
  name: string;
  description?: string | null;
  stallNumber?: string | null;
  mallId?: string | null;
  merchantId: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
  costPrice: unknown;
  sellingPrice: unknown;
  isActive: boolean;
  inventory?: { quantity: number; lowStockThreshold?: number | null } | null;
  _count?: { posSaleItems?: number };
};

export type Product = {
  id: string;
  name: string;
  description?: string | null;
  brand?: string | null;
  status: string;
  stallId: string;
  categoryId?: string | null;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  variants?: ProductVariant[];
};

export type ProductsPage = {
  data: Product[];
  total: number;
  page: number;
  totalPages: number;
};

export type Category = { id: string; name: string };

export type InventoryItem = {
  id: string;
  quantity: number;
  lowStockThreshold?: number | null;
  variant: { id: string; name: string; sellingPrice: unknown; product: { id: string; name: string } };
};

export async function fetchStallsByMerchant(merchantId: string): Promise<Stall[]> {
  const { data } = await api.get<Stall[]>(`/api/v1/stalls/merchant/${merchantId}`);
  return data;
}

export async function fetchProductsByStall(
  stallId: string,
  page = 1,
  limit = 20,
): Promise<ProductsPage> {
  const { data } = await api.get<ProductsPage>(`/api/v1/products/stall/${stallId}`, {
    params: { page, limit },
  });
  return data;
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/api/v1/products/categories');
  return data;
}

export async function fetchInventoryByStall(stallId: string): Promise<InventoryItem[]> {
  const { data } = await api.get<InventoryItem[]>(`/api/v1/inventory/stall/${stallId}`);
  return data;
}

export async function createProduct(body: {
  stallId: string;
  name: string;
  description?: string;
  brand?: string;
  categoryId?: string;
  variants: Array<{
    name: string;
    costPrice: number;
    sellingPrice: number;
    stockQuantity: number;
  }>;
  images?: Array<{ url: string; isPrimary?: boolean }>;
}): Promise<Product> {
  const { data } = await api.post<Product>('/api/v1/products', body);
  return data;
}

export async function updateProduct(
  id: string,
  stallId: string,
  body: {
    name?: string;
    description?: string;
    brand?: string;
    status?: string;
    categoryId?: string;
    images?: Array<{ url: string; isPrimary?: boolean }>;
  },
): Promise<Product> {
  const { data } = await api.patch<Product>(`/api/v1/products/${id}`, { stallId, ...body });
  return data;
}

export async function updateVariant(
  variantId: string,
  body: { sellingPrice?: number; costPrice?: number; isActive?: boolean },
): Promise<ProductVariant> {
  const { data } = await api.patch<ProductVariant>(`/api/v1/products/variants/${variantId}`, body);
  return data;
}

export async function adjustStock(
  variantId: string,
  changeQty: number,
  reason: string,
): Promise<void> {
  await api.post('/api/v1/inventory/adjust', { variantId, changeQty, reason });
}

/** Upload an image file URI and return the CDN url. */
export async function uploadImage(fileUri: string, mimeType = 'image/jpeg'): Promise<string> {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: 'product.jpg',
    type: mimeType,
  } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/api/v1/upload/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Image upload failed');
  const json = await res.json();
  return json.url as string;
}
