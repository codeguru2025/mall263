import { api } from './api';

export type RunMode = 'SAFE_PAY' | 'CASH_ON_DELIVERY' | 'DIRECT_DEAL';
export type RunStatus = 'OPEN' | 'LOCKED' | 'IN_PROGRESS' | 'DELIVERED' | 'AT_PICKUP_POINT' | 'COLLECTED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
export type RunBidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
export type RunStopStatus = 'PENDING' | 'PICKED_UP';

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
}

export interface RunStopItemPayload { variantId: string; quantity: number; }
export interface RunStopPayload { stallId: string; stopOrder: number; items: RunStopItemPayload[]; }
export interface CreateRunPayload {
  stops: RunStopPayload[];
  mode: RunMode;
  dropZone?: string;
  dropAddress?: string;
  dropLat?: number;
  dropLng?: number;
  maxBudget?: number;
  pickupPointId?: string;
}

export interface RunBid {
  id: string;
  driverId: string;
  fee: string;
  message?: string;
  status: RunBidStatus;
  createdAt: string;
  driver: {
    id: string; tier: string; rating: string; completedJobs: number;
    user: { firstName: string; lastName: string; avatarUrl?: string | null };
  };
}

export interface RunStopItem {
  id: string;
  variantId: string;
  quantity: number;
  unitPrice: string;
  currency: string;
  variant: { name: string; product: { name: string; images: { url: string }[] } };
}

export interface RunStop {
  id: string;
  stallId: string;
  stopOrder: number;
  status: RunStopStatus;
  itemAmount: string;
  pickedUpAt?: string;
  collectionPhotoUrl?: string | null;
  collectionVideoUrl?: string | null;
  stall: { id: string; name: string; latitude?: number; longitude?: number; address?: string; phone?: string | null };
  items: RunStopItem[];
}

export interface Run {
  id: string;
  status: RunStatus;
  mode: RunMode;
  dropZone: string;
  dropAddress?: string;
  dropLat?: string;
  dropLng?: string;
  totalDistanceKm?: string;
  suggestedFee?: string;
  maxBudget?: string;
  agreedFee?: string;
  bids: RunBid[];
  stops: RunStop[];
  createdAt: string;
  buyer?: { firstName: string; lastName: string; phone?: string } | null;
  driver?: { id: string; tier: string; rating: string; user: { firstName: string; lastName: string; phone?: string } } | null;
  pickupPoint?: { id: string; name: string; address: string } | null;
  collectionToken?: string | null;
  collectionCode?: string | null;
  collectedAt?: string | null;
}

export const runsApi = {
  create: (payload: CreateRunPayload) =>
    api.post<Run>('/api/v1/runs', payload).then((r) => r.data),

  getMyRuns: () =>
    api.get<Run[]>('/api/v1/runs/my').then((r) => r.data),

  getById: (runId: string) =>
    api.get<Run>(`/api/v1/runs/${runId}`).then((r) => r.data),

  getOpenRuns: () =>
    api.get<Run[]>('/api/v1/runs/driver/open').then((r) => r.data),

  getDriverActiveRun: () =>
    api.get<Run | null>('/api/v1/runs/driver/active').then((r) => r.data),

  placeBid: (runId: string, fee: number, message?: string) =>
    api.post(`/api/v1/runs/${runId}/bids`, { fee, message }).then((r) => r.data),

  withdrawBid: (runId: string) =>
    api.delete(`/api/v1/runs/${runId}/bids/mine`).then((r) => r.data),

  acceptBid: (runId: string, bidId: string) =>
    api.post(`/api/v1/runs/${runId}/bids/${bidId}/accept`).then((r) => r.data),

  confirmPickup: (runId: string, stopId: string, pin: string, gpsLat?: number, gpsLng?: number) =>
    api.post(`/api/v1/runs/${runId}/stops/${stopId}/pickup`, { pin, gpsLat, gpsLng }).then((r) => r.data),

  submitDelivery: (runId: string, photoUrl?: string, videoUrl?: string, gpsLat?: number, gpsLng?: number) =>
    api.post(`/api/v1/runs/${runId}/deliver`, { photoUrl, videoUrl, gpsLat, gpsLng }).then((r) => r.data),

  confirmReceipt: (runId: string) =>
    api.post(`/api/v1/runs/${runId}/confirm`).then((r) => r.data),

  cancel: (runId: string) =>
    api.post(`/api/v1/runs/${runId}/cancel`).then((r) => r.data),

  getStallStops: () =>
    api.get('/api/v1/runs/seller/stops').then((r) => r.data),

  // Pickup points
  getPickupPoints: () =>
    api.get<PickupPoint[]>('/api/v1/pickup-points').then((r) => r.data),

  // QR token handoff
  getStopQr: (runId: string, stopId: string) =>
    api.get<{ token: string }>(`/api/v1/runs/${runId}/stops/${stopId}/qr`).then((r) => r.data),

  getDeliveryQr: (runId: string) =>
    api.get<{ token: string }>(`/api/v1/runs/${runId}/delivery-qr`).then((r) => r.data),

  scanQr: (token: string) =>
    api.post<{ type: string; message: string; stall?: string; items?: any[]; remainingStops?: number }>('/api/v1/runs/scan', { token }).then((r) => r.data),

  // Collection proof upload (after QR/PIN confirms pickup)
  uploadCollectionProof: (runId: string, stopId: string, photoUrl?: string, videoUrl?: string) =>
    api.post(`/api/v1/runs/${runId}/stops/${stopId}/collection-proof`, { photoUrl, videoUrl }).then((r) => r.data),
};
