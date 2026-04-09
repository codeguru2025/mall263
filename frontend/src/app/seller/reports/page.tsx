'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, ShoppingBag, DollarSign, Percent, Package, BarChart3, AlertTriangle } from 'lucide-react';
import FeatureGate from '@/components/FeatureGate';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

type Period = 'today' | '7d' | '30d' | '90d';

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
];

function getRange(period: Period) {
  const now = new Date();
  const end = now.toISOString();
  if (period === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    return { startDate: start.toISOString(), endDate: end };
  }
  const days = PERIODS.find((p) => p.key === period)!.days;
  const start = new Date(now); start.setDate(start.getDate() - days);
  return { startDate: start.toISOString(), endDate: end };
}

export default function SellerReportsPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('7d');

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, router]);

  const { data: merchant } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data).catch(() => null),
    enabled: isAuthenticated,
  });

  const { data: stalls } = useQuery({
    queryKey: ['my-stalls', merchant?.id],
    queryFn: () => api.get(`/api/v1/stalls/merchant/${merchant.id}`).then((r) => r.data),
    enabled: !!merchant?.id,
  });

  const stallId = stalls?.[0]?.id;

  const { data: report, isLoading } = useQuery({
    queryKey: ['stall-report', stallId, period],
    queryFn: () => {
      const { startDate, endDate } = getRange(period);
      return api.get(`/api/v1/reports/stall/${stallId}`, { params: { startDate, endDate } }).then((r) => r.data);
    },
    enabled: !!stallId,
  });

  const { data: todaySummary } = useQuery({
    queryKey: ['daily-summary', stallId],
    queryFn: () => api.get(`/api/v1/pos/summary/stall/${stallId}`).then((r) => r.data),
    enabled: !!stallId,
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ['low-stock', stallId],
    queryFn: () => api.get(`/api/v1/inventory/stall/${stallId}/low-stock`).then((r) => r.data),
    enabled: !!stallId,
  });

  const summary = report?.summary;
  const topProducts: any[] = report?.topProducts || [];
  const dailyBreakdown: any[] = report?.dailyBreakdown || [];

  // Max revenue for bar chart scaling
  const maxRevenue = dailyBreakdown.reduce((m, d) => Math.max(m, d.revenue), 0);

  const StatCard = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) => (
    <div className={`bg-white rounded-2xl border-2 border-gray-100 p-4`}>
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div className="hidden sm:block">
            <h1 className="text-lg font-black text-navy-700">Sales Reports</h1>
            <p className="text-xs text-gray-500">{stalls?.[0]?.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 pb-28 sm:pb-8">
        {/* Today's quick summary */}
        {todaySummary && (
          <div className="bg-gradient-to-br from-navy-700 to-navy-900 text-white rounded-2xl p-5 mb-5">
            <p className="text-white/60 text-xs font-medium mb-1">Today</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black">{formatCurrency(todaySummary.totalRevenue ?? 0)}</p>
                <p className="text-white/60 text-sm mt-1">{todaySummary.salesCount ?? 0} sales · {todaySummary.itemsSold ?? 0} items sold</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-xs">Net Profit</p>
                <p className="text-xl font-black text-brand-green">{formatCurrency(todaySummary.netProfit ?? 0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Low stock alert */}
        {(lowStockItems?.length ?? 0) > 0 && (
          <Link href="/inventory" className="block bg-amber-50 border-2 border-amber-100 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-amber-700 text-sm">{lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} running low on stock</p>
              <p className="text-xs text-amber-500">Tap to manage inventory</p>
            </div>
          </Link>
        )}

        {/* Period selector */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                period === p.key ? 'bg-navy-700 text-white' : 'bg-white text-navy-600 border-2 border-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border-2 border-gray-100 p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : summary ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatCard label="Revenue" value={formatCurrency(summary.totalRevenue)} sub={`${summary.totalSales} sales`} color="text-navy-700" />
              <StatCard label="Net Profit" value={formatCurrency(summary.netProfit)} sub={`After ${formatCurrency(summary.totalCommission)} commission`} color="text-brand-green" />
              <StatCard label="Gross Profit" value={formatCurrency(summary.grossProfit)} sub={`Cost: ${formatCurrency(summary.totalCost)}`} color="text-brand-blue" />
              <StatCard label="Avg Order" value={formatCurrency(summary.avgOrderValue)} sub={`${summary.totalSales} orders`} color="text-brand-orange" />
            </div>

            {/* Profit margin */}
            {summary.totalRevenue > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-navy-700">Profit Margin</p>
                  <p className="font-black text-brand-green">{((summary.netProfit / summary.totalRevenue) * 100).toFixed(1)}%</p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-green rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, (summary.netProfit / summary.totalRevenue) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Daily revenue chart */}
            {dailyBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-brand-blue" />
                  <h3 className="font-bold text-navy-700 text-sm">Daily Revenue</h3>
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

            {/* Top products */}
            {topProducts.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-brand-green" />
                  <h3 className="font-bold text-navy-700 text-sm">Top Products</h3>
                </div>
                <div className="space-y-3">
                  {topProducts.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-black text-gray-400">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-navy-700 truncate">{p.productName}</p>
                        <p className="text-xs text-gray-400">{p._sum?.quantity || 0} units sold</p>
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
            <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No sales data yet</p>
            <p className="text-gray-400 text-sm mt-1">Process sales in POS to see reports here</p>
            <Link href="/pos" className="mt-4 inline-block btn-primary text-sm">Go to POS</Link>
          </div>
        )}

        <Link href="/sales" className="block text-center text-sm font-bold text-brand-blue hover:underline mt-4">
          View All Transactions →
        </Link>
      </div>
    </div>
  );
}
