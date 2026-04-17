import { api } from '@/lib/api';

export type ChatRoomRow = {
  id: string;
  offerId: string;
  createdAt: string;
  messages?: Array<{
    id: string;
    content: string;
    createdAt: string;
    sender?: { id: string; firstName?: string | null } | null;
  }>;
  offer?: {
    id: string;
    totalPrice?: unknown;
    status?: string;
    demand?: { title?: string | null } | null;
    stall?: { name?: string | null } | null;
  } | null;
};

export type ChatMessageRow = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export async function fetchMyChatRooms(): Promise<ChatRoomRow[]> {
  const { data } = await api.get<ChatRoomRow[]>('/api/v1/chat/rooms');
  return data;
}

export async function openOfferChatRoom(offerId: string): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/api/v1/chat/rooms/${offerId}`);
  return data;
}

export async function fetchChatMessages(roomId: string, after?: string): Promise<ChatMessageRow[]> {
  const params = after ? { after } : undefined;
  const { data } = await api.get<ChatMessageRow[]>(`/api/v1/chat/rooms/${roomId}/messages`, { params });
  return data;
}

export async function sendChatMessage(roomId: string, content: string): Promise<ChatMessageRow> {
  const { data } = await api.post<ChatMessageRow>(`/api/v1/chat/rooms/${roomId}/messages`, { content });
  return data;
}
