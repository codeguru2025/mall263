import axios from 'axios';
import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/token-storage';
import { getApiBaseUrl } from '@/lib/config';

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
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentWidth?: number | null;
  attachmentHeight?: number | null;
  attachmentSize?: number | null;
  isEdited?: boolean;
  editedAt?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type ChatAttachmentPayload = {
  url: string;
  type?: 'image' | 'video' | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
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

export async function sendChatMessage(
  roomId: string,
  content: string,
  attachment?: ChatAttachmentPayload | null,
): Promise<ChatMessageRow> {
  const body: Record<string, unknown> = { content };
  if (attachment?.url) {
    body.attachmentUrl = attachment.url;
    body.attachmentType = attachment.type ?? 'image';
    if (attachment.width != null) body.attachmentWidth = attachment.width;
    if (attachment.height != null) body.attachmentHeight = attachment.height;
    if (attachment.size != null) body.attachmentSize = attachment.size;
  }
  const { data } = await api.post<ChatMessageRow>(`/api/v1/chat/rooms/${roomId}/messages`, body);
  return data;
}

export async function editChatMessage(messageId: string, content: string): Promise<ChatMessageRow> {
  const { data } = await api.patch<ChatMessageRow>(`/api/v1/chat/messages/${messageId}`, { content });
  return data;
}

/**
 * Uploads a local image file URI to the backend `/upload/chat-media` endpoint.
 * The server stores the file on DO Spaces and returns the public CDN URL.
 * Caller is expected to have already compressed the asset client-side
 * (e.g. via expo-image-manipulator) before handing it to this helper —
 * the backend will still re-encode to WebP at 1400px max, but shaving off
 * bytes upfront makes the upload finish in a couple of seconds on 3G.
 */
export async function uploadChatMedia(
  fileUri: string,
  opts: { mimeType?: string; filename?: string } = {},
): Promise<{ url: string; size: number; mimetype: string }> {
  const token = await getAccessToken();
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: opts.filename ?? 'chat.jpg',
    type: opts.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  const res = await fetch(`${getApiBaseUrl()}/api/v1/upload/chat-media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.message === 'string') message = body.message;
      else if (Array.isArray(body?.message)) message = body.message.join(', ');
    } catch {
      // response was not JSON — keep the generic message.
    }
    throw new Error(message);
  }
  const json = (await res.json()) as {
    url?: string;
    cdnUrl?: string;
    size?: number;
    mimetype?: string;
  };
  const url = json.cdnUrl || json.url;
  if (!url) throw new Error('Upload succeeded but no URL was returned');
  return { url, size: json.size ?? 0, mimetype: json.mimetype ?? 'image/webp' };
}
