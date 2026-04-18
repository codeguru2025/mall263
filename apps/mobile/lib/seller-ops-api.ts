import { api } from '@/lib/api';

// ── POS sales ───────────────────────────────────────────────────────────────

export type POSSaleRow = {
  id: string;
  receiptNumber: string;
  totalAmount: unknown;
  subtotal?: unknown;
  discountAmount?: unknown;
  taxAmount?: unknown;
  commissionAmount?: unknown;
  currency?: string;
  paymentMethod?: string;
  status?: string;
  customerPhone?: string | null;
  notes?: string | null;
  createdAt: string;
  cashier?: { firstName?: string; lastName?: string } | null;
  items?: Array<{
    id: string;
    productName: string;
    variantName?: string;
    quantity: number;
    unitPrice: unknown;
    totalPrice: unknown;
  }>;
};

export type POSSalesPage = {
  data?: POSSaleRow[];
  sales?: POSSaleRow[];
  total?: number;
  page?: number;
  limit?: number;
};

export async function fetchPosSales(
  stallId: string,
  opts: { startDate?: string; endDate?: string; page?: number; limit?: number } = {},
): Promise<POSSaleRow[]> {
  const params: Record<string, unknown> = {};
  if (opts.startDate) params.startDate = opts.startDate;
  if (opts.endDate) params.endDate = opts.endDate;
  if (opts.page) params.page = opts.page;
  if (opts.limit) params.limit = opts.limit;
  const { data } = await api.get<POSSalesPage | POSSaleRow[]>(
    `/api/v1/pos/sales/stall/${stallId}`,
    { params },
  );
  if (Array.isArray(data)) return data;
  return data.data ?? data.sales ?? [];
}

export async function fetchPosSale(saleId: string): Promise<POSSaleRow> {
  const { data } = await api.get<POSSaleRow>(`/api/v1/pos/sales/${saleId}`);
  return data;
}

export type PosDailySummary = {
  date?: string;
  totalSales?: number | string;
  totalRevenue?: number | string;
  totalCommission?: number | string;
  totalDiscount?: number | string;
  totalTax?: number | string;
  totalRefunds?: number | string;
  netRevenue?: number | string;
  salesCount?: number;
  salesByPaymentMethod?: Record<string, number | string>;
  [key: string]: unknown;
};

export async function fetchPosDailySummary(
  stallId: string,
  date?: string,
): Promise<PosDailySummary> {
  const { data } = await api.get<PosDailySummary>(
    `/api/v1/pos/summary/stall/${stallId}`,
    { params: date ? { date } : undefined },
  );
  return data;
}

// ── Expenses ────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'SALARY'
  | 'TRANSPORT'
  | 'MEALS'
  | 'RENT'
  | 'UTILITIES'
  | 'SUPPLIES'
  | 'MARKETING'
  | 'MAINTENANCE'
  | 'OTHER';

export type ExpenseRow = {
  id: string;
  stallId: string;
  category: ExpenseCategory | string;
  amount: unknown;
  currency?: string;
  description?: string | null;
  occurredAt: string;
  createdAt?: string;
  createdBy?: { firstName?: string; lastName?: string } | null;
};

export async function fetchExpenses(
  stallId: string,
  opts: { startDate?: string; endDate?: string; category?: ExpenseCategory; limit?: number } = {},
): Promise<ExpenseRow[]> {
  const params: Record<string, unknown> = {};
  if (opts.startDate) params.startDate = opts.startDate;
  if (opts.endDate) params.endDate = opts.endDate;
  if (opts.category) params.category = opts.category;
  if (opts.limit) params.limit = opts.limit;
  const { data } = await api.get<ExpenseRow[] | { data?: ExpenseRow[] }>(
    `/api/v1/expenses/stall/${stallId}`,
    { params },
  );
  if (Array.isArray(data)) return data;
  return data?.data ?? [];
}

export async function createExpense(
  stallId: string,
  payload: {
    category: ExpenseCategory;
    amount: number;
    currency?: string;
    description?: string;
    occurredAt: string;
  },
): Promise<ExpenseRow> {
  const { data } = await api.post<ExpenseRow>(`/api/v1/expenses/stall/${stallId}`, payload);
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/api/v1/expenses/${id}`);
}

// ── Reports ─────────────────────────────────────────────────────────────────

export type StallReport = {
  stall?: { id: string; name: string };
  period?: { startDate: string; endDate: string };
  sales?: {
    totalRevenue?: number | string;
    totalCommission?: number | string;
    salesCount?: number;
    netRevenue?: number | string;
    avgOrderValue?: number | string;
    [key: string]: unknown;
  };
  expenses?: {
    total?: number | string;
    byCategory?: Record<string, number | string>;
    [key: string]: unknown;
  };
  engagement?: {
    visits?: number;
    uniqueVisitors?: number;
    [key: string]: unknown;
  };
  insights?: Array<{ type?: string; title?: string; description?: string }>;
  profit?: number | string;
  [key: string]: unknown;
};

export async function fetchStallReport(
  stallId: string,
  startDate: string,
  endDate: string,
): Promise<StallReport> {
  const { data } = await api.get<StallReport>(`/api/v1/reports/stall/${stallId}`, {
    params: { startDate, endDate },
  });
  return data;
}
