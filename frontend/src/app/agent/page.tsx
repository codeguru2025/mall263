'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { Logo } from '@/components/Logo';
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Search,
  UserPlus,
  ClipboardList,
  Store,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'onboard' | 'tasks' | 'merchants';

const TASK_TYPE_LABEL: Record<string, string> = {
  MERCHANT_ONBOARDING: 'Merchant onboarding',
  PRODUCT_CAPTURE: 'Product capture',
  QUALITY_REVIEW: 'Quality review',
  STALL_VERIFICATION: 'Stall verification',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-800 border-blue-200',
  COMPLETED: 'bg-green-50 text-green-800 border-green-200',
  FAILED: 'bg-red-50 text-red-800 border-red-200',
  SYNCING: 'bg-gray-50 text-gray-700 border-gray-200',
};

function AgentHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get('tab') || 'onboard') as Tab;
  const tab: Tab = ['onboard', 'tasks', 'merchants'].includes(tabParam) ? tabParam : 'onboard';

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const queryClient = useQueryClient();

  const [phoneQ, setPhoneQ] = useState('');
  const debouncedQ = useDebounce(phoneQ, 400);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    if (user?.role !== 'FIELD_AGENT') {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, user?.role, router]);

  const { data: stats } = useQuery({
    queryKey: ['agent-stats'],
    queryFn: () => api.get('/api/v1/agents/stats').then((r) => r.data),
    enabled: user?.role === 'FIELD_AGENT',
    staleTime: 30_000,
  });

  const { data: candidates, isFetching: candidatesLoading } = useQuery({
    queryKey: ['agent-candidates', debouncedQ],
    queryFn: () =>
      api.get('/api/v1/agents/onboarding-candidates', { params: { q: debouncedQ } }).then((r) => r.data),
    enabled: user?.role === 'FIELD_AGENT' && debouncedQ.replace(/\D/g, '').length >= 5,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['agent-tasks'],
    queryFn: () => api.get('/api/v1/agents/tasks').then((r) => r.data),
    enabled: user?.role === 'FIELD_AGENT' && tab === 'tasks',
  });

  const { data: merchantsData, isLoading: merchantsLoading } = useQuery({
    queryKey: ['agent-merchants'],
    queryFn: () => api.get('/api/v1/merchants', { params: { page: 1, limit: 50 } }).then((r) => r.data),
    enabled: user?.role === 'FIELD_AGENT' && tab === 'merchants',
  });

  const onboardMutation = useMutation({
    mutationFn: (body: { userId: string; businessName: string; businessPhone?: string }) =>
      api.post('/api/v1/merchants/onboard', body).then((r) => r.data),
    onSuccess: () => {
      toast.success('Seller onboarded — they are now a stall owner and can finish setup.');
      queryClient.invalidateQueries({ queryKey: ['agent-merchants'] });
      queryClient.invalidateQueries({ queryKey: ['agent-candidates'] });
      setSelectedUserId(null);
      setBusinessName('');
      setBusinessPhone('');
      setPhoneQ('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Onboarding failed'),
  });

  const queueTaskMutation = useMutation({
    mutationFn: (body: { type: string; data: Record<string, unknown>; offlineId?: string }) =>
      api.post('/api/v1/agents/tasks', body).then((r) => r.data),
    onSuccess: () => {
      toast.success('Task saved — process it when you have connectivity.');
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Could not save task'),
  });

  const processTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.post(`/api/v1/agents/tasks/${taskId}/process`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Onboarding task completed');
      queryClient.invalidateQueries({ queryKey: ['agent-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
      queryClient.invalidateQueries({ queryKey: ['agent-merchants'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Could not process task'),
  });

  const setTab = (t: Tab) => {
    const qs = t === 'onboard' ? '' : `?tab=${t}`;
    router.replace(`/agent${qs}`, { scroll: false });
  };

  if (authLoading || !user || user.role !== 'FIELD_AGENT') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
      </div>
    );
  }

  const candidateRows: any[] = candidates?.data || [];
  const selected = candidateRows.find((c: any) => c.id === selectedUserId);

  const submitOnboard = () => {
    if (!selectedUserId || !businessName.trim()) {
      toast.error('Select a seller and enter a business name');
      return;
    }
    onboardMutation.mutate({
      userId: selectedUserId,
      businessName: businessName.trim(),
      businessPhone: businessPhone.trim() || undefined,
    });
  };

  const queueOfflineTask = () => {
    if (!selectedUserId || !businessName.trim()) {
      toast.error('Select a seller and enter a business name');
      return;
    }
    queueTaskMutation.mutate({
      type: 'MERCHANT_ONBOARDING',
      data: {
        userId: selectedUserId,
        businessName: businessName.trim(),
        businessPhone: businessPhone.trim() || undefined,
      },
      offlineId: `web-${Date.now()}-${selectedUserId.slice(0, 8)}`,
    });
  };

  const tabs: { id: Tab; label: string; icon: typeof UserPlus }[] = [
    { id: 'onboard', label: 'Onboard', icon: UserPlus },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList },
    { id: 'merchants', label: 'Merchants', icon: Store },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-8">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 safe-area-top">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-navy-700 tracking-tight">Field agent</h1>
            <p className="text-[11px] text-gray-500 font-medium">Onboard sellers &amp; track tasks</p>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                tab === t.id
                  ? 'bg-navy-700 text-white border-navy-700'
                  : 'bg-white text-navy-600 border-gray-100 hover:border-gray-200'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total tasks', value: stats?.total ?? '—', color: 'bg-gray-100 text-navy-700' },
            { label: 'Done', value: stats?.completed ?? '—', color: 'bg-green-50 text-green-800' },
            { label: 'Pending', value: stats?.pending ?? '—', color: 'bg-amber-50 text-amber-800' },
            { label: 'Failed', value: stats?.failed ?? '—', color: 'bg-red-50 text-red-800' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl p-4 border border-gray-100 ${s.color}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{s.label}</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {tab === 'onboard' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Search className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <h2 className="font-black text-navy-700">Find the seller</h2>
                  <p className="text-xs text-gray-500">
                    They must have a Mall263 account as a <strong>buyer</strong> first (registered with their phone).
                  </p>
                </div>
              </div>
              <input
                type="tel"
                className="input w-full"
                placeholder="Type phone digits (e.g. 0771…)"
                value={phoneQ}
                onChange={(e) => {
                  setPhoneQ(e.target.value);
                  setSelectedUserId(null);
                }}
              />
              <p className="text-xs text-gray-400 mt-2">At least 5 digits. We match buyers who do not have a shop yet.</p>

              {debouncedQ.replace(/\D/g, '').length >= 5 && (
                <div className="mt-4 space-y-2 max-h-56 overflow-y-auto">
                  {candidatesLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
                    </div>
                  ) : candidateRows.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No matching buyers without a merchant profile.</p>
                  ) : (
                    candidateRows.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(c.id);
                          setBusinessPhone(c.phone || '');
                        }}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between gap-2 ${
                          selectedUserId === c.id
                            ? 'border-brand-orange bg-orange-50'
                            : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-navy-700 text-sm truncate">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">{c.phone}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selected && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand-green" />
                  <h2 className="font-black text-navy-700">Business details</h2>
                </div>
                <div>
                  <label className="label">Business / shop name</label>
                  <input
                    className="input w-full"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Tinashe Electronics"
                  />
                </div>
                <div>
                  <label className="label">Business phone (optional)</label>
                  <input
                    className="input w-full"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                    placeholder="Defaults to account phone if empty"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={onboardMutation.isPending}
                    onClick={submitOnboard}
                    className="btn-primary flex-1 py-3.5 flex items-center justify-center gap-2"
                  >
                    {onboardMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Onboard now
                  </button>
                  <button
                    type="button"
                    disabled={queueTaskMutation.isPending}
                    onClick={queueOfflineTask}
                    className="btn-secondary flex-1 py-3.5"
                  >
                    {queueTaskMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin inline" /> : null}
                    Queue task only
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  <strong>Onboard now</strong> promotes them to stall owner immediately.
                  <strong> Queue task only</strong> saves a record you can <strong>Process</strong> later from the Tasks tab (e.g. flaky data).
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="space-y-3">
            {tasksLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
              </div>
            ) : !tasks?.length ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500 text-sm">
                No tasks yet. Onboard a seller or queue a task from the Onboard tab.
              </div>
            ) : (
              tasks.map((task: any) => (
                <div
                  key={task.id}
                  className="bg-white rounded-2xl border-2 border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                          STATUS_STYLE[task.status] || STATUS_STYLE.PENDING
                        }`}
                      >
                        {task.status}
                      </span>
                      <span className="text-xs font-bold text-navy-600">
                        {TASK_TYPE_LABEL[task.type] || task.type}
                      </span>
                    </div>
                    {task.type === 'MERCHANT_ONBOARDING' && task.data && (
                      <p className="text-sm text-gray-600 truncate">
                        {(task.data as any).businessName || '—'} · User {(task.data as any).userId?.slice(0, 8)}…
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1 font-mono">{task.id}</p>
                  </div>
                  {task.type === 'MERCHANT_ONBOARDING' && task.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={processTaskMutation.isPending}
                      onClick={() => processTaskMutation.mutate(task.id)}
                      className="btn-primary text-sm py-2.5 px-4 whitespace-nowrap"
                    >
                      {processTaskMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Process'}
                    </button>
                  )}
                  {task.status === 'FAILED' && (
                    <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Fix data &amp; create a new task
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'merchants' && (
          <div className="space-y-3">
            {merchantsLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
              </div>
            ) : (
              <>
                {(merchantsData?.data || []).map((m: any) => (
                  <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="font-black text-navy-700">{m.businessName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {m.user?.firstName} {m.user?.lastName} · <span className="font-mono">{m.user?.phone}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2 uppercase font-bold">{m.status}</p>
                  </div>
                ))}
                {(merchantsData?.data || []).length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-10">No merchants in directory yet.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
        </div>
      }
    >
      <AgentHubContent />
    </Suspense>
  );
}
