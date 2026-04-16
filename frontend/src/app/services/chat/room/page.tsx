'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

/**
 * Resolver page: given ?quoteId=xxx, POST to create/get the service chat room
 * then redirect to /services/chat/[roomId].
 */
function RoomResolver() {
  const searchParams  = useSearchParams();
  const quoteId       = searchParams.get('quoteId');
  const router        = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading     = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (!quoteId) { router.push('/services/requests'); return; }

    api.post(`/api/v1/services/chat/rooms/${quoteId}`)
      .then((r) => { router.replace(`/services/chat/${r.data.id}`); })
      .catch((e) => {
        toast.error(e?.response?.data?.message ?? 'Cannot open chat');
        router.back();
      });
  }, [authLoading, isAuthenticated, quoteId, router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
    </div>
  );
}

export default function ServiceChatRoomPage() {
  return (
    <Suspense>
      <RoomResolver />
    </Suspense>
  );
}
