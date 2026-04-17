import { api } from '@/lib/api';

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: unknown;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationsPage = {
  data: NotificationRow[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type NotificationFilter = 'all' | 'unread';

export async function fetchNotificationsPage(
  page: number,
  limit: number,
  filter: NotificationFilter,
): Promise<NotificationsPage> {
  const params: Record<string, string | number | boolean> = { page, limit };
  if (filter === 'unread') params.isRead = false;
  const { data } = await api.get<NotificationsPage>('/api/v1/notifications', { params });
  return data;
}

export async function markNotificationRead(id: string): Promise<NotificationRow> {
  const { data } = await api.patch<NotificationRow>(`/api/v1/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<{ count?: number }> {
  const { data } = await api.patch<{ count?: number }>('/api/v1/notifications/read-all');
  return data;
}
