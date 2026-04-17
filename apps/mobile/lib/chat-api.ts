import axios from 'axios';
import { api } from '@/lib/api';

export type ChatInboxResult = {
  rooms: ChatRoomRow[];
  /**
   * When the backend returns 5xx we swallow it to an empty list so the screen
   * never gets stuck on an error. The UI shows a soft banner instead. This
   * carries the extracted server message / Prisma code for that banner.
   */
  softError?: string;
};

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

/**
 * Resilient variant used by the inbox screen. 5xx responses are converted into
 * an empty result + a soft banner so the UI never blocks on a transient
 * backend hiccup. Anything else (401 / network error) is rethrown so React
 * Query can surface it normally.
 */
export async function fetchMyChatRoomsSafe(): Promise<ChatInboxResult> {
  try {
    const { data } = await api.get<ChatRoomRow[]>('/api/v1/chat/rooms');
    return { rooms: Array.isArray(data) ? data : [] };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status ?? 0;
      if (status >= 500) {
        const body = err.response?.data as
          | { message?: string | string[]; prismaCode?: string }
          | undefined;
        const msg = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        const code = body?.prismaCode ? ` [${body.prismaCode}]` : '';
        const softError =
          typeof msg === 'string' && msg.trim()
            ? `${msg}${code}`
            : 'Chat service is temporarily unavailable — showing empty inbox.';
        return { rooms: [], softError };
      }
    }
    throw err;
  }
}

export async function fetchChatVersion(): Promise<{
  tag?: string;
  commit?: string;
  deployedAt?: string | null;
  now?: string;
} | null> {
  try {
    const { data } = await api.get('/api/v1/chat/_version');
    return data;
  } catch {
    return null;
  }
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
