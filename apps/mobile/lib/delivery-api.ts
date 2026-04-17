import { api } from './api';

export type DeliveryMode = 'SAFE_PAY' | 'CASH_ON_DELIVERY' | 'DIRECT_DEAL';
export type DeliveryJobStatus =
  | 'BROADCAST'
  | 'ACCEPTED'
  | 'PICKUP_CONFIRMED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURNED';

export interface CreateJobDto {
  orderId: string;
  orderType: 'OFFER' | 'POS_SALE';
  sellerId: string;
  buyerId: string;
  mode: DeliveryMode;
  pickupZone: string;
  dropZone: string;
  pickupAddress?: string;
  dropAddress?: string;
  itemAmount: number;
  deliveryFee: number;
}

export interface DeliveryJob {
  id: string;
  orderId: string;
  orderType: string;
  sellerId: string;
  buyerId: string;
  driverId?: string;
  mode: DeliveryMode;
  status: DeliveryJobStatus;
  pickupZone: string;
  dropZone: string;
  pickupAddress?: string;
  dropAddress?: string;
  itemAmount: number | string;
  deliveryFee: number | string;
  platformFee: number | string;
  driverEarning: number | string;
  pickupPhotoUrl?: string;
  pickupGpsLat?: number | string | null;
  pickupGpsLng?: number | string | null;
  deliveryPhotoUrl?: string;
  deliveryGpsLat?: number | string | null;
  deliveryGpsLng?: number | string | null;
  broadcastedAt?: string;
  acceptedAt?: string;
  completedAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  escrow?: {
    id: string;
    status: string;
    totalHeld: number | string;
  };
  dispute?: {
    id: string;
    status: string;
    reason: string;
  };
  driver?: {
    id: string;
    tier: string;
    currentLat?: number | string | null;
    currentLng?: number | string | null;
    user: { firstName: string; lastName: string; phone: string };
  };
}

export async function createDeliveryJob(dto: CreateJobDto): Promise<DeliveryJob> {
  const { data } = await api.post('/api/v1/delivery/jobs', dto);
  return data;
}

export async function getMyJobs(): Promise<DeliveryJob[]> {
  const { data } = await api.get('/api/v1/delivery/jobs/my');
  return data;
}

export async function getBroadcastJobs(): Promise<DeliveryJob[]> {
  const { data } = await api.get('/api/v1/delivery/jobs/broadcast');
  return data;
}

export async function getJob(jobId: string): Promise<DeliveryJob> {
  const { data } = await api.get(`/api/v1/delivery/jobs/${jobId}`);
  return data;
}

export async function acceptJob(jobId: string): Promise<DeliveryJob> {
  const { data } = await api.post(`/api/v1/delivery/jobs/${jobId}/accept`);
  return data;
}

export async function confirmPickup(
  jobId: string,
  dto: { photoUrl: string; gpsLat: number; gpsLng: number },
): Promise<DeliveryJob> {
  const { data } = await api.post(`/api/v1/delivery/jobs/${jobId}/pickup-confirm`, dto);
  return data;
}

export async function confirmDelivery(
  jobId: string,
  dto: { photoUrl: string; gpsLat: number; gpsLng: number },
): Promise<DeliveryJob> {
  const { data } = await api.post(`/api/v1/delivery/jobs/${jobId}/deliver`, dto);
  return data;
}

export async function buyerConfirmReceipt(jobId: string): Promise<DeliveryJob> {
  const { data } = await api.post(`/api/v1/delivery/jobs/${jobId}/confirm-receipt`);
  return data;
}

export async function cancelJob(jobId: string, reason: string): Promise<DeliveryJob> {
  const { data } = await api.post(`/api/v1/delivery/jobs/${jobId}/cancel`, { reason });
  return data;
}

// ── Driver APIs ─────────────────────────────────────────────────────────────

export async function registerDriver(dto: {
  vehicleType: string;
  kycDocUrl?: string;
}): Promise<void> {
  await api.post('/api/v1/drivers/register', dto);
}

export async function getDriverProfile(): Promise<{
  id: string;
  tier: string;
  isActive: boolean;
  kycVerified: boolean;
  completedJobs: number;
  totalEarnings: number | string;
  floatBalance: number | string;
  codCashHeld: number | string;
  maxCodExposure: number | string;
  rating: number | string;
}> {
  const { data } = await api.get('/api/v1/drivers/me');
  return data;
}

// ── Dispute APIs ─────────────────────────────────────────────────────────────

export async function openDispute(
  jobId: string,
  dto: { reason: string; evidence?: unknown },
): Promise<void> {
  await api.post(`/api/v1/disputes/${jobId}`, dto);
}

export async function getMyDisputes(): Promise<
  Array<{
    id: string;
    jobId: string;
    reason: string;
    status: string;
    resolution?: string;
    createdAt: string;
    job: { id: string; mode: string; status: string; itemAmount: number | string; pickupZone: string; dropZone: string };
  }>
> {
  const { data } = await api.get('/api/v1/disputes/my');
  return data;
}
