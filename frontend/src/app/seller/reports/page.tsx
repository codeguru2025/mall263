'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  ShoppingBag,
  BarChart3,
  AlertTriangle,
  Lightbulb,
  Eye,
  MousePointerClick,
  Receipt,
  Plus,
  Trash2,
  Store,
  CalendarRange,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

type Period = 'today' | '7d' | '30d' | '90d' | 'custom';

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
];

const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'SALARY', label: 'Salary & wages' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'MEALS', label: 'Meals' },
  { value: 'RENT', label: 'Rent' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'SUPPLIES', label: 'Supplies' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'FEES', label: 'Fees' },
  { value: 'TAXES', label: 'Taxes' },
  { value: 'OTHER', label: 'Other' },
];

function getRange(period: Period, customStart?: string, customEnd?: string) {
  const now = new Date();
  const end = now.toISOString();
  if (period === 'custom' && customStart && customEnd) {
    const s = new Date(customStart);
    s.setHours(0, 0, 0, 0);
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    return { startDate: s.toISOString(), endDate: e.toISOString() };
  }
  if (period === 'custom') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { startDate: start.toISOString(), endDate: end };
  }
  if (period === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { startDate: start.toISOString(), endDate: end };
  }
  const days = PERIODS.find((p) => p.key === period)!.days;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return { startDate: start.toISOString(), endDate: end };
}

function insightStyles(severity: string) {
  if (severity === 'positive') return 'border-green-200 bg-green-50 text-green-900';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-blue-100 bg-blue-50/80 text-navy-800';
}

export default function SellerReportsPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedStallId, setSelectedStallId] = useState<string>('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExp, setNewExp] = useState({
    category: 'OTHER',
    amount: '',
    description: '',
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data: merchant } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data).catch(() => null),
    enabled: isAuthenticated,
  });

  const { data: stalls = [], isError: stallsError } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: !!merchant?.id,
  });

  useEffect(() => {
    if (stalls.length && !selectedStallId) setSelectedStallId(stalls[0].id);
  }, [stalls, selectedStallId]);

  const range = useMemo(
    () => getRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  const { data: report, isLoading } = useQuery({
    queryKey: ['stall-report', selectedStallId, range.startDate, range.endDate],
    queryFn: () =>
      api
        .get(`/api/v1/reports/stall/${selectedStallId}`, {
          params: { startDate: range.startDate, endDate: range.endDate },
        })
        .then((r) => r.data),
    enabled: !!selectedStallId,
  });

  const { data: expenseRows = [] } = useQuery({
    queryKey: ['stall-expenses', selectedStallId, range.startDate, range.endDate],
    queryFn: () =>
      api
        .get(`/api/v1/expenses/stall/${selectedStallId}`, {
          params: { startDate: range.startDate, endDate: range.endDate, limit: 200 },
        })
        .then((r) => r.data),
    enabled: !!selectedStallId,
  });

  const createExpense = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/expenses/stall/${selectedStallId}`, {
        category: newExp.category,
        amount: parseFloat(newExp.amount),
        description: newExp.description || undefined,
        occurredAt: `${newExp.occurredAt}T12:00:00.000Z`,
      }),
    onSuccess: () => {
      toast.success('Expense recorded');
      setNewExp((s) => ({ ...s, amount: '', description: '' }));
      setShowExpenseForm(false);
      queryClient.invalidateQueries({ queryKey: ['stall-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['stall-report'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/expenses/${id}`),
    onSuccess: () => {
      toast.success('Removed');
      queryClient.invalidateQueries({ queryKey: ['stall-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['stall-report'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const { data: todaySummary } = useQuery({
    queryKey: ['daily-summary', selectedStallId],
    queryFn: () => api.get(`/api/v1/pos/summary/stall/${selectedStallId}`).then((r) => r.data),
    enabled: !!selectedStallId,
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ['low-stock', selectedStallId],
    queryFn: () => api.get(`/api/v1/inventory/stall/${selectedStallId}/low-stock`).then((r) => r.data),
    enabled: !!selectedStallId,
  });

  const summary = report?.summary;
  const topProducts: any[] = report?.topProducts || [];
  const dailyBreakdown: any[] = report?.dailyBreakdown || [];
  const insights: any[] = report?.insights || [];
  const expensesBlock = report?.expenses;
  const engagement = report?.engagement;

  const maxRevenue = dailyBreakdown.reduce((m, d) => Math.max(m, d.revenue), 0);

  const StatCard = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) => (
    <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className={`text-xl sm:text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 safe-area-top">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div className="hidden sm:block min-w-0">
            <h1 className="text-lg font-black text-navy-700 truncate">Store reports</h1>
            <p className="text-xs text-gray-500">Sales, costs, expenses &amp; footfall</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 pb-28 sm:pb-8">
        {stalls.length > 1 && (
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Stall</label>
            <select
              value={selectedStallId}
              onChange={(e) => setSelectedStallId(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-gray-100 bg-white py-3 px-4 text-sm font-bold text-navy-700"
            >
              {stalls.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.stallNumber}
                </option>
              ))}
            </select>
          </div>
        )}

        {todaySummary && (
          <div className="bg-gradient-to-br from-navy-700 to-navy-900 text-white rounded-2xl p-5 mb-5">
            <p className="text-white/60 text-xs font-medium mb-1">Today (live)</p>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl sm:text-3xl font-black">{formatCurrency(todaySummary.totalRevenue ?? 0)}</p>
                <p className="text-white/60 text-sm mt-1">
                  {todaySummary.salesCount ?? 0} sales · {todaySummary.itemsSold ?? 0} items
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-xs">Net (after commission)</p>
                <p className="text-lg font-black text-brand-green">{formatCurrency(todaySummary.netProfit ?? 0)}</p>
              </div>
            </div>
          </div>
        )}

        {(lowStockItems?.length ?? 0) > 0 && (
          <Link href="/inventory" className="bg-amber-50 border-2 border-amber-100 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-amber-700 text-sm">
                {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} low on stock
              </p>
              <p className="text-xs text-amber-500">Restock to avoid missed sales</p>
            </div>
          </Link>
        )}

        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                period === p.key ? 'bg-navy-700 text-white' : 'bg-white text-navy-600 border-2 border-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
              period === 'custom' ? 'bg-navy-700 text-white' : 'bg-white text-navy-600 border-2 border-gray-100'
            }`}
          >
            <CalendarRange className="w-4 h-4" /> Custom
          </button>
        </div>

        {period === 'custom' && (
          <div className="flex gap-2 mb-5">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 rounded-xl border-2 border-gray-100 px-3 py-2 text-sm font-semibold"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 rounded-xl border-2 border-gray-100 px-3 py-2 text-sm font-semibold"
            />
          </div>
        )}

        {stallsError ? (
          <div className="text-center py-16">
            <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">Failed to load stall data</p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border-2 border-gray-100 p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : summary ? (
          <>
            {insights.length > 0 && (
              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2 text-sm font-black text-navy-700">
                  <Lightbulb className="w-4 h-4 text-brand-orange" /> Insights
                </div>
                {insights.map((ins: any) => (
                  <div
                    key={ins.id}
                    className={`rounded-2xl border-2 px-4 py-3 text-sm ${insightStyles(ins.severity)}`}
                  >
                    <p className="font-bold">{ins.title}</p>
                    <p className="opacity-90 mt-1 leading-snug">{ins.detail}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatCard label="Revenue" value={formatCurrency(summary.totalRevenue)} sub={`${summary.totalSales} sales`} color="text-navy-700" />
              <StatCard
                label="After expenses"
                value={formatCurrency(summary.profitAfterExpenses ?? summary.netProfit)}
                sub="Net − operating costs"
                color="text-brand-green"
              />
              <StatCard
                label="Net (POS)"
                value={formatCurrency(summary.netProfit)}
                sub={`Commission ${formatCurrency(summary.totalCommission)}`}
                color="text-brand-blue"
              />
              <StatCard
                label="Expenses"
                value={formatCurrency(summary.totalExpenses ?? 0)}
                sub={`${summary.expenseEntryCount ?? 0} entries`}
                color="text-brand-orange"
              />
            </div>

            {engagement && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <MousePointerClick className="w-4 h-4 text-brand-blue" />
                  <h3 className="font-bold text-navy-700 text-sm">Engagement (period)</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                    <Store className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-lg font-black text-navy-700">{engagement.storePageViews ?? 0}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">Store views</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-lg font-black text-navy-700">{engagement.productDetailViews ?? 0}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-bold">Product views</p>
                    </div>
                  </div>
                </div>
                {(engagement.topProductsByViews?.length ?? 0) > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 mb-2">Most viewed listings</p>
                    <div className="space-y-2">
                      {engagement.topProductsByViews.slice(0, 6).map((row: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-navy-700 font-medium truncate pr-2">{row.productName || 'Product'}</span>
                          <span className="text-gray-400 font-bold flex-shrink-0">{row.views} views</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {expensesBlock?.byCategory?.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-brand-orange" />
                    <h3 className="font-bold text-navy-700 text-sm">Expenses by category</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowExpenseForm((v) => !v)}
                    className="text-xs font-bold text-brand-green flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {expensesBlock.byCategory.map((c: any) => {
                    const pct =
                      expensesBlock.total > 0 ? Math.round((c.total / expensesBlock.total) * 100) : 0;
                    return (
                      <div key={c.category}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-navy-700">{c.category}</span>
                          <span className="text-gray-500">
                            {formatCurrency(c.total)} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-orange rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(!expensesBlock?.byCategory?.length || showExpenseForm) && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-navy-700 text-sm">Record expense</p>
                  {expensesBlock?.byCategory?.length > 0 && (
                    <button type="button" className="text-xs text-gray-400" onClick={() => setShowExpenseForm(false)}>
                      Close
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <select
                    value={newExp.category}
                    onChange={(e) => setNewExp((s) => ({ ...s, category: e.target.value }))}
                    className="w-full rounded-xl border-2 border-gray-100 py-2.5 px-3 text-sm font-semibold"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={newExp.amount}
                    onChange={(e) => setNewExp((s) => ({ ...s, amount: e.target.value }))}
                    className="w-full rounded-xl border-2 border-gray-100 py-2.5 px-3 text-sm"
                  />
                  <input
                    type="date"
                    value={newExp.occurredAt}
                    onChange={(e) => setNewExp((s) => ({ ...s, occurredAt: e.target.value }))}
                    className="w-full rounded-xl border-2 border-gray-100 py-2.5 px-3 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={newExp.description}
                    onChange={(e) => setNewExp((s) => ({ ...s, description: e.target.value }))}
                    className="w-full rounded-xl border-2 border-gray-100 py-2.5 px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!newExp.amount || createExpense.isPending || !selectedStallId}
                    onClick={() => createExpense.mutate()}
                    className="w-full py-3 rounded-xl bg-navy-700 text-white text-sm font-bold disabled:opacity-40"
                  >
                    Save expense
                  </button>
                </div>
              </div>
            )}

            {(expenseRows as any[]).length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <h3 className="font-bold text-navy-700 text-sm mb-3">Recent expense entries</h3>
                <div className="space-y-2">
                  {(expenseRows as any[]).slice(0, 15).map((ex: any) => (
                    <div key={ex.id} className="flex items-center gap-2 text-sm border-b border-gray-50 pb-2 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-navy-700">{ex.category}</p>
                        <p className="text-xs text-gray-400 truncate">{ex.description || new Date(ex.occurredAt).toLocaleDateString()}</p>
                      </div>
                      <p className="font-black text-brand-orange flex-shrink-0">{formatCurrency(parseFloat(ex.amount))}</p>
                      <button
                        type="button"
                        onClick={() => deleteExpense.mutate(ex.id)}
                        className="p-2 text-gray-300 hover:text-brand-red"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.totalRevenue > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-navy-700">Margin after commission</p>
                  <p className="font-black text-brand-green">
                    {((summary.netProfit / summary.totalRevenue) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-green rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, (summary.netProfit / summary.totalRevenue) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {dailyBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-brand-blue" />
                  <h3 className="font-bold text-navy-700 text-sm">Daily revenue</h3>
                </div>
                <div className="flex items-end gap-1 h-28">
                  {dailyBreakdown.slice(-14).map((d: any, i: number) => {
                    const pct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-gray-100 rounded-t-sm relative" style={{ height: '100px' }}>
                          <div
                            className="absolute bottom-0 w-full bg-brand-blue rounded-t-sm transition-all"
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-gray-400 rotate-45 origin-left whitespace-nowrap">
                          {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {topProducts.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-brand-green" />
                  <h3 className="font-bold text-navy-700 text-sm">Top sellers (POS)</h3>
                </div>
                <div className="space-y-3">
                  {topProducts.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-black text-gray-400">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy-700 truncate">{p.productName}</p>
                        <p className="text-xs text-gray-400">{p._sum?.quantity || 0} units</p>
                      </div>
                      <p className="font-black text-brand-green text-sm">{formatCurrency(parseFloat(p._sum?.totalPrice || 0))}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No report data yet</p>
            <p className="text-gray-400 text-sm mt-1">Run POS sales and log expenses to build your picture</p>
            <Link href="/pos" className="mt-4 inline-block btn-primary text-sm">
              Go to POS
            </Link>
          </div>
        )}

        <Link href="/sales" className="block text-center text-sm font-bold text-brand-blue hover:underline mt-4">
          View all transactions →
        </Link>
      </div>
    </div>
  );
}
