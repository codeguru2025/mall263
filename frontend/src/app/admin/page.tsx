'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Users, Store, Package, DollarSign, TrendingUp, Gavel, ChevronRight, BarChart3, Shield } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function AdminPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
  });

  const { data: activity } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => api.get('/admin/recent-activity').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, iconColor: 'text-brand-blue', bg: 'bg-blue-50' },
    { label: 'Merchants', value: stats?.totalMerchants || 0, icon: Store, iconColor: 'text-brand-green', bg: 'bg-green-50' },
    { label: 'Products', value: stats?.totalProducts || 0, icon: Package, iconColor: 'text-brand-orange', bg: 'bg-orange-50' },
    { label: 'Total Sales', value: stats?.totalSales || 0, icon: TrendingUp, iconColor: 'text-brand-green', bg: 'bg-green-50' },
    { label: 'Commission', value: formatCurrency(stats?.commissionRevenue || 0), icon: DollarSign, iconColor: 'text-brand-red', bg: 'bg-red-50' },
    { label: 'Live Demands', value: stats?.activeDemands || 0, icon: Gavel, iconColor: 'text-brand-orange', bg: 'bg-orange-50' },
  ];

  const quickActions = [
    { href: '/admin/users', icon: Users, label: 'Manage Users', desc: 'Suspend, activate, or view user details', color: 'text-brand-blue', bg: 'bg-blue-50', border: 'hover:border-brand-blue' },
    { href: '/admin/merchants', icon: Store, label: 'Manage Merchants', desc: 'Verify, suspend, or manage merchant accounts', color: 'text-brand-green', bg: 'bg-green-50', border: 'hover:border-brand-green' },
    { href: '/admin/stalls', icon: Shield, label: 'Manage Stalls', desc: 'Approve, suspend, or manage market stalls', color: 'text-brand-orange', bg: 'bg-orange-50', border: 'hover:border-brand-orange' },
    { href: '/reports', icon: BarChart3, label: 'Platform Reports', desc: 'View sales, commission, and user reports', color: 'text-brand-red', bg: 'bg-red-50', border: 'hover:border-brand-red' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex-shrink-0"><Logo size={30} /></Link>
            <div>
              <h1 className="text-lg font-black text-navy-700">Admin Console</h1>
              <p className="text-xs text-gray-500">Platform management</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border-2 border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                  <p className="text-xl font-black text-navy-700">{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-black text-lg text-navy-700">Recent Sales</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {(activity?.recentSales || []).slice(0, 5).map((sale: any) => (
                <div key={sale.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div>
                    <span className="text-sm font-bold text-navy-700">#{sale.receiptNumber}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{sale.stall?.name}</p>
                  </div>
                  <span className="text-sm font-black text-brand-green">{formatCurrency(parseFloat(sale.totalAmount))}</span>
                </div>
              ))}
              {(!activity?.recentSales || activity.recentSales.length === 0) && (
                <div className="text-center py-8">
                  <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No recent sales</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-black text-lg text-navy-700">Quick Actions</h2>
            </div>
            <div className="p-3 space-y-2">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href} className={`flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 ${action.border} hover:shadow-sm transition-all group`}>
                  <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center flex-shrink-0`}>
                    <action.icon className={`w-5 h-5 ${action.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-navy-700">{action.label}</div>
                    <div className="text-xs text-gray-500">{action.desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
