'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';

type ChatRoomRow = {
  id: string;
  createdAt: string;
  messages?: Array<{
    id: string;
    content: string;
    createdAt: string;
    sender?: { id: string; firstName?: string | null } | null;
  }>;
  offer?: {
    demand?: { title?: string | null } | null;
    stall?: { name?: string | null } | null;
  } | null;
};

function roomTitle(room: ChatRoomRow): string {
  const t = room.offer?.demand?.title?.trim();
  return t || 'Offer chat';
}

function roomSubtitle(room: ChatRoomRow): string {
  const s = room.offer?.stall?.name?.trim();
  return s || 'Accepted offer conversation';
}

function formatWhen(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function ChatInboxPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data = [], isLoading, isError, refetch } = useQuery<ChatRoomRow[]>({
    queryKey: ['chat-rooms'],
    queryFn: () => api.get('/api/v1/chat/rooms').then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-6">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/demands" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={28} />
          <div>
            <h1 className="text-base font-black text-navy-700">Chats</h1>
            <p className="text-xs text-gray-400">Accepted demand conversations</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        ) : isError ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-sm text-brand-red font-bold">Could not load chats.</p>
            <button onClick={() => refetch()} className="btn-primary mt-4 py-2.5 px-4 text-sm">
              Retry
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <MessageCircle className="w-9 h-9 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No chat rooms yet. Accept an offer to start chatting.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((room) => {
              const last = room.messages?.[0];
              const unread = !!last?.sender?.id && last.sender.id !== user?.id;
              return (
                <Link
                  key={room.id}
                  href={`/chat/${room.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-brand-blue/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-navy-700 truncate">{roomTitle(room)}</p>
                      <p className="text-xs text-brand-blue mt-1 truncate">{roomSubtitle(room)}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {formatWhen(last?.createdAt || room.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                    {last ? `${last.sender?.firstName ?? 'User'}: ${last.content}` : 'No messages yet.'}
                  </p>
                  {unread ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-brand-orange">
                      <span className="w-2 h-2 rounded-full bg-brand-orange" />
                      Unread
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>Tap to open room</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
