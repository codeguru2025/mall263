'use client';

import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function ServiceChatRoomPage() {
  const { roomId }  = useParams<{ roomId: string }>();
  const router      = useRouter();
  const user        = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading     = useAuthStore((s) => s.isLoading);
  const [message, setMessage] = useState('');
  const bottomRef   = useRef<HTMLDivElement>(null);
  const qc          = useQueryClient();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data: messages = [], isLoading } = useQuery<any[]>({
    queryKey: ['svc-chat', roomId],
    queryFn: () =>
      api.get(`/api/v1/services/chat/rooms/${roomId}/messages`).then((r) => r.data),
    enabled: !!roomId && isAuthenticated,
  });

  // Poll every 3 s
  useEffect(() => {
    if (!roomId || !isAuthenticated) return;
    const interval = setInterval(async () => {
      const current: any[] = qc.getQueryData(['svc-chat', roomId]) ?? [];
      const after = current.length > 0 ? current[current.length - 1].createdAt : undefined;
      try {
        const { data: newMsgs } = await api.get(
          `/api/v1/services/chat/rooms/${roomId}/messages`,
          { params: after ? { after } : {} },
        );
        if (newMsgs.length > 0) {
          qc.setQueryData(['svc-chat', roomId], (old: any[] = []) => {
            const ids = new Set(old.map((m: any) => m.id));
            return [...old, ...newMsgs.filter((m: any) => !ids.has(m.id))];
          });
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [roomId, isAuthenticated, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/v1/services/chat/rooms/${roomId}/messages`, { content }).then((r) => r.data),
    onSuccess: (msg) => {
      qc.setQueryData(['svc-chat', roomId], (old: any[] = []) => [...old, msg]);
      setMessage('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not send message'),
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    sendMut.mutate(text);
  }

  return (
    <div className="h-dvh flex flex-col bg-white">
      <header className="flex-shrink-0 bg-white border-b border-gray-100 safe-area-top z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-50 text-navy-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-black text-navy-700 text-sm">Service Chat</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 font-semibold mt-12">
            No messages yet — start the conversation!
          </p>
        ) : (
          messages.map((msg: any) => {
            const isMine = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                {!isMine && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 relative">
                    {msg.sender?.avatarUrl ? (
                      <Image src={msg.sender.avatarUrl} alt="" fill className="object-cover" sizes="28px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-600">
                        {msg.sender?.firstName?.[0]}
                      </div>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[72%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? 'bg-brand-blue text-white rounded-br-sm'
                      : 'bg-gray-100 text-navy-700 rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 safe-area-bottom bg-white">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-2xl border-2 border-gray-100 px-4 py-2.5 text-sm text-navy-700 placeholder-gray-400 focus:outline-none focus:border-brand-blue"
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMut.isPending}
            className="w-10 h-10 rounded-2xl bg-brand-blue text-white flex items-center justify-center disabled:opacity-50"
          >
            {sendMut.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
