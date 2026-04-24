'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Users, Store, Package, DollarSign, TrendingUp, Gavel, ChevronRight, BarChart3, Shield, Tag, Settings, Building2, LifeBuoy, CreditCard, Megaphone, Ticket, Truck, AlertTriangle } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { isAdminConsoleDashboardRole } from '@mall263/shared';

const SUPPORT_ADMIN_ROLE = 'SUPPORT_ADMIN';

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const isAdmin = isAuthenticated && user != null && isAdminConsoleDashboardRole(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (user?.role === SUPPORT_ADMIN_ROLE) {
      router.replace('/admin/support');
      return;
    }
    if (user && !isAdminConsoleDashboardRole(user.role)) router.push('/dashboard');
  }, [authLoading, isAuthenticated, user, router]);

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/v1/admin/dashboard').then((r) => r.data),
    enabled: isAdmin,
  });

  const { data: activity } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => api.get('/api/v1/admin/activity').then((r) => r.data),
    enabled: isAdmin,
  });

  if (authLoading || !isAdmin) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500 font-semibold">Failed to load admin dashboard. Check your permissions.</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.users || 0, icon: Users, iconColor: 'text-brand-blue', bg: 'bg-blue-50' },
    { label: 'Merchants', value: stats?.merchants || 0, icon: Store, iconColor: 'text-brand-green', bg: 'bg-green-50' },
    { label: 'Products', value: stats?.products || 0, icon: Package, iconColor: 'text-brand-orange', bg: 'bg-orange-50' },
    { label: 'Total Sales', value: stats?.sales || 0, icon: TrendingUp, iconColor: 'text-brand-green', bg: 'bg-green-50' },
    { label: 'Commission', value: formatCurrency(parseFloat(stats?.totalCommissionRevenue || '0')), icon: DollarSign, iconColor: 'text-brand-red', bg: 'bg-red-50' },
    { label: 'Live Demands', value: stats?.openDemands || 0, icon: Gavel, iconColor: 'text-brand-orange', bg: 'bg-orange-50' },
  ];

  const quickActions = [
    { href: '/admin/users', icon: Users, label: 'Manage Users', desc: 'Suspend, activate, or view user details', color: 'text-brand-blue', bg: 'bg-blue-50', border: 'hover:border-brand-blue' },
    { href: '/admin/merchants', icon: Store, label: 'Manage Merchants', desc: 'Verify, suspend, or manage merchant accounts', color: 'text-brand-green', bg: 'bg-green-50', border: 'hover:border-brand-green' },
    { href: '/admin/malls', icon: Building2, label: 'Manage Malls', desc: 'Add markets and malls where sellers register stalls', color: 'text-teal-600', bg: 'bg-teal-50', border: 'hover:border-teal-400' },
    { href: '/admin/stalls', icon: Shield, label: 'Manage Stalls', desc: 'Approve, suspend, or manage market stalls', color: 'text-brand-orange', bg: 'bg-orange-50', border: 'hover:border-brand-orange' },
    { href: '/admin/categories', icon: Tag, label: 'Manage Categories', desc: 'Add, edit, or organize product categories', color: 'text-purple-600', bg: 'bg-purple-50', border: 'hover:border-purple-600' },
    { href: '/reports', icon: BarChart3, label: 'Platform Reports', desc: 'View sales, commission, and user reports', color: 'text-brand-red', bg: 'bg-red-50', border: 'hover:border-brand-red' },
    { href: '/admin/subscriptions', icon: CreditCard, label: 'Subscription Manager', desc: 'View all subscribers, extend trials, grant free months', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'hover:border-indigo-400' },
    { href: '/admin/subscription-plans', icon: CreditCard, label: 'Subscription Plans', desc: 'Set pricing, trial length, and plan features for sellers', color: 'text-violet-600', bg: 'bg-violet-50', border: 'hover:border-violet-400' },
    { href: '/admin/promotions', icon: Ticket, label: 'Promotions & Referrals', desc: 'Create discount codes and referral programmes', color: 'text-pink-600', bg: 'bg-pink-50', border: 'hover:border-pink-400' },
    { href: '/admin/ads', icon: Megaphone, label: 'Ads & Banners', desc: 'Manage in-app ads, banners, and scheduled promotions', color: 'text-amber-600', bg: 'bg-amber-50', border: 'hover:border-amber-400' },
    { href: '/admin/deliveries', icon: Truck, label: 'Delivery Jobs', desc: 'Monitor all platform delivery jobs in real time', color: 'text-teal-600', bg: 'bg-teal-50', border: 'hover:border-teal-400' },
    { href: '/admin/drivers', icon: Truck, label: 'Drivers', desc: 'Approve KYC, manage tiers and driver accounts', color: 'text-teal-700', bg: 'bg-teal-50', border: 'hover:border-teal-600' },
    { href: '/admin/disputes', icon: AlertTriangle, label: 'Disputes', desc: 'Resolve delivery disputes and release escrow funds', color: 'text-brand-red', bg: 'bg-red-50', border: 'hover:border-brand-red' },
    { href: '/admin/settings', icon: Settings, label: 'App Settings', desc: 'Feature flags, delivery rate, and platform configuration', color: 'text-gray-600', bg: 'bg-gray-50', border: 'hover:border-gray-400' },
    { href: '/admin/support', icon: LifeBuoy, label: 'Help requests', desc: 'Review and resolve client support tickets', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'hover:border-cyan-400' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 safe-area-top">
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

      <div className="max-w-7xl mx-auto px-4 py-6 pb-24 sm:pb-6">
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
              <h2 className="font-black text-lg text-navy-700">Recent Activity</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {(activity || []).slice(0, 5).map((log: any) => (
                <div key={log.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div>
                    <span className="text-sm font-bold text-navy-700">{log.action}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}</p>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {(!activity || activity.length === 0) && (
                <div className="text-center py-8">
                  <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No recent activity</p>
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
