import { api } from '@/lib/api';

export async function updateDriverLocation(lat: number, lng: number): Promise<void> {
  await api.patch('/api/v1/drivers/me/location', { lat, lng });
}
