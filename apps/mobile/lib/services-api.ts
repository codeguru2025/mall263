import { api } from '@/lib/api';

export type ServiceListing = {
  id: string;
  title: string;
  description?: string | null;
  priceFrom?: unknown;
  currency?: string;
  imageUrl?: string | null;
  isActive?: boolean;
  viewCount?: number;
  category?: { id: string; name: string; slug?: string } | null;
  mall?: { id: string; name: string; city?: string | null } | null;
  stall?: {
    id: string;
    name?: string | null;
    logoUrl?: string | null;
  } | null;
  provider?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    phone?: string | null;
  } | null;
};

export type ServiceBrowseResponse = {
  data: ServiceListing[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export type ServiceRequestStatus = 'OPEN' | 'QUOTED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
export type ServiceQuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
export type ServiceInvoiceStatus = 'PENDING' | 'PAID' | 'VOIDED';

export type ServiceQuote = {
  id: string;
  requestId: string;
  providerId: string;
  amount: unknown;
  description?: string | null;
  estimatedDays?: number | null;
  status: ServiceQuoteStatus;
  createdAt: string;
  provider?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type ServiceRequestRow = {
  id: string;
  listingId: string;
  clientId: string;
  notes?: string | null;
  budgetHint?: unknown;
  status: ServiceRequestStatus;
  createdAt: string;
  listing?: ServiceListing | null;
  client?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  } | null;
  quotes?: ServiceQuote[];
};

export type ServiceInvoice = {
  id: string;
  quoteId: string;
  invoiceNumber: string;
  totalAmount: unknown;
  paymentMethod: string;
  status: ServiceInvoiceStatus;
  createdAt: string;
  data?: unknown;
  quote?: {
    request?: { listing?: { title?: string | null } | null } | null;
    provider?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
};

export type ServiceChatMessageRow = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export async function browseServices(params: {
  q?: string;
  mallId?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}): Promise<ServiceBrowseResponse> {
  const { data } = await api.get('/api/v1/services/browse', { params });
  // Backend may return either { data: [...] } or a bare array — normalize.
  if (Array.isArray(data)) return { data };
  return data;
}

export async function fetchServiceListing(id: string): Promise<ServiceListing> {
  const { data } = await api.get<ServiceListing>(`/api/v1/services/${id}`);
  return data;
}

export async function createServiceRequest(
  listingId: string,
  body: { notes?: string; budgetHint?: number },
): Promise<ServiceRequestRow> {
  const { data } = await api.post(`/api/v1/services/${listingId}/requests`, body);
  return data;
}

export async function fetchMyServiceRequests(): Promise<ServiceRequestRow[]> {
  const { data } = await api.get('/api/v1/services/requests/mine');
  return Array.isArray(data) ? data : [];
}

export async function fetchIncomingServiceRequests(): Promise<ServiceRequestRow[]> {
  const { data } = await api.get('/api/v1/services/requests/incoming');
  return Array.isArray(data) ? data : [];
}

export async function fetchServiceRequest(requestId: string): Promise<ServiceRequestRow> {
  const { data } = await api.get(`/api/v1/services/requests/${requestId}`);
  return data;
}

export async function submitServiceQuote(
  requestId: string,
  body: { amount: number; description?: string; estimatedDays?: number },
): Promise<ServiceQuote> {
  const { data } = await api.post(`/api/v1/services/requests/${requestId}/quote`, body);
  return data;
}

export async function acceptServiceQuote(quoteId: string): Promise<ServiceQuote> {
  const { data } = await api.post(`/api/v1/services/quotes/${quoteId}/accept`);
  return data;
}

export async function rejectServiceQuote(quoteId: string): Promise<ServiceQuote> {
  const { data } = await api.post(`/api/v1/services/quotes/${quoteId}/reject`);
  return data;
}

export async function completeServiceQuote(
  quoteId: string,
  paymentMethod = 'CASH',
): Promise<ServiceInvoice> {
  const { data } = await api.post(`/api/v1/services/quotes/${quoteId}/complete`, { paymentMethod });
  return data;
}

export async function fetchServiceInvoice(invoiceId: string): Promise<ServiceInvoice> {
  const { data } = await api.get(`/api/v1/services/invoices/${invoiceId}`);
  return data;
}

export async function markServiceInvoicePaid(invoiceId: string): Promise<ServiceInvoice> {
  const { data } = await api.patch(`/api/v1/services/invoices/${invoiceId}/paid`);
  return data;
}

export async function openServiceChatRoom(quoteId: string): Promise<{ id: string }> {
  const { data } = await api.post(`/api/v1/services/chat/rooms/${quoteId}`);
  return data;
}

export async function fetchServiceMessages(
  roomId: string,
  after?: string,
): Promise<ServiceChatMessageRow[]> {
  const { data } = await api.get(`/api/v1/services/chat/rooms/${roomId}/messages`, {
    params: after ? { after } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

export async function sendServiceMessage(
  roomId: string,
  content: string,
): Promise<ServiceChatMessageRow> {
  const { data } = await api.post(`/api/v1/services/chat/rooms/${roomId}/messages`, { content });
  return data;
}
