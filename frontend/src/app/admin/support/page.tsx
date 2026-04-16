'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { Logo } from '@/components/Logo';
import { ChevronLeft, Loader2 } from 'lucide-react';

const SUPPORT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN_OPS', 'SUPPORT_ADMIN']);

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

type SupportRow = {
  id: string;
  topic: string;
  message: string;
  status: (typeof STATUSES)[number];
  adminNotes: string | null;
  assignedToId: string | null;
  createdAt: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  user: { id: string; firstName: string; lastName: string; phone: string; role: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
};

export default function AdminSupportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const [filter, setFilter] = useState<string>('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const canAccess = isAuthenticated && user != null && SUPPORT_ROLES.has(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (user && !SUPPORT_ROLES.has(user.role)) router.push('/dashboard');
  }, [authLoading, isAuthenticated, user, router]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-support-requests', filter],
    queryFn: () =>
      api
        .get<SupportRow[]>('/api/v1/admin/support-requests', {
          params: filter ? { status: filter } : {},
        })
        .then((r) => r.data),
    enabled: canAccess,
  });

  const patchMutation = useMutation({
    mutationFn: (payload: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/api/v1/admin/support-requests/${payload.id}`, payload.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support-requests'] });
      toast.success('Updated');
    },
    onError: () => toast.error('Update failed'),
  });

  if (authLoading || !canAccess) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={user?.role === 'SUPPORT_ADMIN' ? '/' : '/admin'} className="text-navy-700 hover:text-brand-blue">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <Logo size={28} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Help requests</h1>
            <p className="text-xs text-gray-500">Assign, add notes, and close client tickets</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === '' ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === s ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase text-brand-orange">{row.status.replace(/_/g, ' ')}</span>
                    <h2 className="font-black text-navy-800 mt-1">{row.topic}</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(row.createdAt).toLocaleString()} ·{' '}
                      {row.user
                        ? `${row.user.firstName} ${row.user.lastName} (${row.user.phone})`
                        : `${row.contactName ?? '—'} · ${row.contactPhone ?? '—'}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        patchMutation.mutate({
                          id: row.id,
                          body: { status: e.target.value },
                        })
                      }
                      className="text-xs font-bold rounded-lg border border-gray-200 px-2 py-1.5"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="text-xs font-bold rounded-lg border border-gray-200 px-2 py-1.5 hover:bg-gray-50"
                      onClick={() =>
                        patchMutation.mutate({
                          id: row.id,
                          body: { status: 'IN_PROGRESS', assignedToId: user?.id },
                        })
                      }
                    >
                      Assign to me
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{row.message}</p>
                {row.assignedTo && (
                  <p className="text-xs text-gray-500 mt-2">
                    Assigned: {row.assignedTo.firstName} {row.assignedTo.lastName}
                  </p>
                )}
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <textarea
                    value={notesDraft[row.id] ?? row.adminNotes ?? ''}
                    onChange={(e) => setNotesDraft((d) => ({ ...d, [row.id]: e.target.value }))}
                    placeholder="Internal notes (visible to admins)"
                    rows={2}
                    className="flex-1 text-sm rounded-xl border border-gray-200 px-3 py-2"
                  />
                  <button
                    type="button"
                    className="btn-primary text-xs py-2 px-4 self-start sm:self-end"
                    onClick={() =>
                      patchMutation.mutate({
                        id: row.id,
                        body: { adminNotes: notesDraft[row.id] ?? row.adminNotes ?? '' },
                      })
                    }
                  >
                    Save notes
                  </button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <p className="text-center text-gray-500 text-sm py-12">No requests in this view.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
