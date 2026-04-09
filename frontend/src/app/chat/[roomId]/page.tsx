'use client';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Logo } from '@/components/Logo';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [message, setMessage] = useState('');
  const [lastTimestamp, setLastTimestamp] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  // Load initial messages
  const { data: messages = [], isLoading } = useQuery<any[]>({
    queryKey: ['chat', roomId],
    queryFn: () => api.get(`/api/v1/chat/rooms/${roomId}/messages`).then((r) => r.data),
    enabled: isAuthenticated && !!roomId,
  });

  // Poll for new messages every 3 seconds
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!roomId || !isAuthenticated) return;
    const interval = setInterval(async () => {
      const current: any[] = queryClient.getQueryData(['chat', roomId]) ?? [];
      const after = current.length > 0 ? current[current.length - 1].createdAt : undefined;
      try {
        const { data: newMsgs } = await api.get(`/api/v1/chat/rooms/${roomId}/messages`, {
          params: after ? { after } : {},
        });
        if (newMsgs.length > 0) {
          queryClient.setQueryData(['chat', roomId], (old: any[] = []) => {
            const ids = new Set(old.map((m: any) => m.id));
            return [...old, ...newMsgs.filter((m: any) => !ids.has(m.id))];
          });
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [roomId, isAuthenticated, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/v1/chat/rooms/${roomId}/messages`, { content }).then((r) => r.data),
    onSuccess: (newMsg) => {
      queryClient.setQueryData(['chat', roomId], (old: any[] = []) => [...old, newMsg]);
      setMessage('');
      inputRef.current?.focus();
    },
    onError: () => toast.error('Failed to send message. Please try again.'),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sendMessage.isPending) return;
    sendMessage.mutate(trimmed);
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => { if (window.history.length > 1) { router.back(); } else { router.push('/demands'); } }} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </button>
          <Logo size={28} />
          <div>
            <h1 className="text-base font-black text-navy-700">Chat</h1>
            <p className="text-xs text-gray-400">Offer conversation</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto px-4 py-4 space-y-3 pb-28">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.sender?.id === user?.id;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-brand-blue to-brand-green flex-shrink-0 relative">
                  {msg.sender?.avatarUrl ? (
                    <Image src={msg.sender.avatarUrl} alt={msg.sender.firstName} fill className="object-cover" sizes="32px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                      {msg.sender?.firstName?.[0]}{msg.sender?.lastName?.[0]}
                    </div>
                  )}
                </div>
                {/* Bubble */}
                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {!isMe && (
                    <span className="text-xs text-gray-400 px-1">{msg.sender?.firstName}</span>
                  )}
                  <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-brand-blue text-white rounded-br-sm'
                      : 'bg-white border border-gray-100 text-navy-700 rounded-bl-sm shadow-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 pb-safe z-40">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm text-navy-700 outline-none focus:border-brand-blue transition-colors"
          />
          <button
            type="submit"
            disabled={!message.trim() || sendMessage.isPending}
            className="w-11 h-11 bg-brand-blue hover:bg-blue-600 text-white rounded-2xl flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {sendMessage.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
