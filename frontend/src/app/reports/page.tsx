'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { ArrowLeft, BarChart3, DollarSign, TrendingUp, Users, Store, Gavel, Loader2 } from 'lucide-react';
import { isAdminConsoleDashboardRole } from '@mall263/shared';

export default function ReportsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const isAdmin = isAuthenticated && user && isAdminConsoleDashboardRole(user.role);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !isAdminConsoleDashboardRole(user.role)) router.push('/dashboard');
  }, [authLoading, isAuthenticated, user, router]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/v1/admin/dashboard').then((r) => r.data),
    enabled: !!isAdmin,
  });

  if (authLoading || !isAdmin) return null;

  const reportCards = stats ? [
    { label: 'Total Users', value: stats.users ?? 0, icon: Users, color: 'text-brand-blue', bg: 'bg-blue-50' },
    { label: 'Total Merchants', value: stats.merchants ?? 0, icon: Store, color: 'text-brand-green', bg: 'bg-green-50' },
    { label: 'Total Sales', value: stats.sales ?? 0, icon: TrendingUp, color: 'text-brand-green', bg: 'bg-green-50' },
    { label: 'Commission Earned', value: formatCurrency(parseFloat(stats.totalCommissionRevenue || '0')), icon: DollarSign, color: 'text-brand-red', bg: 'bg-red-50' },
    { label: 'Open Demands', value: stats.openDemands ?? 0, icon: Gavel, color: 'text-brand-orange', bg: 'bg-orange-50' },
    { label: 'Products Listed', value: stats.products ?? 0, icon: BarChart3, color: 'text-brand-blue', bg: 'bg-blue-50' },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Platform Reports</h1>
            <p className="text-xs text-gray-500">Sales, commission, and user stats</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {reportCards.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl border-2 border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
                <p className="text-2xl font-black text-navy-700">{card.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
