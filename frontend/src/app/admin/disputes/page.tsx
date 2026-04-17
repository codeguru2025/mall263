'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, AlertTriangle, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-brand-red',
  UNDER_REVIEW: 'bg-orange-100 text-brand-orange',
  RESOLVED_SELLER: 'bg-green-100 text-brand-green',
  RESOLVED_BUYER: 'bg-green-100 text-brand-green',
  RESOLVED_RESERVE: 'bg-gray-100 text-gray-600',
};

const OUTCOME_OPTIONS = [
  { value: 'RESOLVED_SELLER', label: 'Favour Seller — release escrow to seller' },
  { value: 'RESOLVED_BUYER', label: 'Favour Buyer — refund escrow to buyer' },
  { value: 'RESOLVED_RESERVE', label: 'Split to Reserve — send to risk pool' },
];

export default function AdminDisputesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();
  const [filter, setFilter] = useState('OPEN');
  const [resolving, setResolving] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('RESOLVED_BUYER');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['SUPER_ADMIN', 'ADMIN_OPS', 'SUPPORT_ADMIN'].includes(user.role)) router.push('/dashboard');
  }, [isAuthenticated, user, router]);

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['admin-disputes', filter],
    queryFn: () => api.get('/api/v1/disputes', { params: { status: filter || undefined } }).then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const resolveMut = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.post(`/api/v1/disputes/${id}/resolve`, { outcome, resolution }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Dispute resolved.');
      setResolving(null);
      setResolution('');
      qc.invalidateQueries({ queryKey: ['admin-disputes'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Failed to resolve'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/v1/disputes/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Status updated.');
      qc.invalidateQueries({ queryKey: ['admin-disputes'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Failed to update'),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={28} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Disputes</h1>
            <p className="text-xs text-gray-400">Resolve delivery disputes &amp; release escrow</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_RESERVE', ''].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                filter === s ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-gray-100 bg-white text-gray-500'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
        ) : disputes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-bold">No disputes in this category</p>
          </div>
        ) : (
          disputes.map((d: any) => (
            <div key={d.id} className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-brand-orange flex-shrink-0" />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {d.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</span>
                </div>

                <p className="text-sm font-bold text-navy-700 mb-1">&ldquo;{d.reason}&rdquo;</p>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                  <span>Job: <span className="font-mono text-navy-700">{d.jobId?.slice(0, 8)}…</span></span>
                  <span>Mode: <span className="font-bold text-navy-700">{d.job?.mode?.replace(/_/g, ' ') ?? '—'}</span></span>
                  <span>Item: <span className="font-bold text-navy-700">{d.job?.itemAmount != null ? formatCurrency(parseFloat(d.job.itemAmount)) : '—'}</span></span>
                  <span>Raised by: <span className="font-bold text-navy-700">{d.raisedBy?.firstName} {d.raisedBy?.lastName}</span></span>
                </div>

                {d.resolution && (
                  <div className="bg-green-50 rounded-xl p-3 text-xs text-brand-green font-semibold mb-3">
                    Resolution: {d.resolution}
                  </div>
                )}

                {/* Actions for open/under-review disputes */}
                {['OPEN', 'UNDER_REVIEW'].includes(d.status) && (
                  <div className="flex gap-2 flex-wrap">
                    {d.status === 'OPEN' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: d.id, status: 'UNDER_REVIEW' })}
                        disabled={updateStatus.isPending}
                        className="text-xs font-bold px-3 py-2 rounded-xl bg-orange-50 text-brand-orange border border-orange-200 hover:bg-orange-100 transition-colors"
                      >
                        Mark Under Review
                      </button>
                    )}
                    <button
                      onClick={() => setResolving(resolving === d.id ? null : d.id)}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-brand-blue text-white hover:bg-blue-600 transition-colors"
                    >
                      Resolve
                    </button>
                    <Link
                      href={`/delivery/${d.jobId}`}
                      className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1"
                    >
                      View Job <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Resolve form */}
              {resolving === d.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                  <p className="text-xs font-black text-navy-700 uppercase tracking-wide">Resolve Dispute</p>
                  <div className="space-y-2">
                    {OUTCOME_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setOutcome(opt.value)}
                        className={`w-full text-left text-sm p-3 rounded-xl border-2 transition-all ${
                          outcome === opt.value ? 'border-brand-blue bg-blue-50 text-brand-blue font-bold' : 'border-gray-100 bg-white text-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="input min-h-[64px] resize-none text-sm"
                    placeholder="Resolution note (visible to both parties)…"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResolving(null)}
                      className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => resolveMut.mutate({ id: d.id })}
                      disabled={!resolution.trim() || resolveMut.isPending}
                      className="flex-1 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {resolveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Confirm Resolution
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
