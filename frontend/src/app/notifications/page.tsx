'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ArrowLeft, Bell, Loader2, CheckCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-all'],
    queryFn: () => api.get('/api/v1/notifications', { params: { limit: 100 } }).then((r) => r.data),
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/api/v1/notifications/read-all').then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All marked as read');
    },
  });

  const markOne = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications: any[] = data?.data ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div className="flex-1">
            <h1 className="text-lg font-black text-navy-700">Notifications</h1>
            {unread > 0 && <p className="text-xs text-brand-orange">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="flex items-center gap-1.5 text-xs font-bold text-brand-blue hover:text-navy-700 transition-colors px-3 py-1.5 rounded-xl hover:bg-blue-50"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="font-bold text-navy-700 mb-1">No notifications</p>
              <p className="text-gray-400 text-sm">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.isRead) markOne.mutate(n.id); }}
                  className={`w-full px-5 py-4 flex items-start gap-3 text-left transition-colors hover:bg-gray-50 ${!n.isRead ? 'bg-orange-50/40' : ''}`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${!n.isRead ? 'bg-brand-orange' : 'bg-gray-200'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold text-navy-700 ${!n.isRead ? 'font-bold' : ''}`}>
                      {n.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString('en-ZW', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
