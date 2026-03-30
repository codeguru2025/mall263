'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Store, ShoppingCart, Wallet, Package, Gavel, Users, Bell, Settings, BarChart3, PlusCircle, ArrowUpRight, ArrowDownLeft, Lock, ChevronRight, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Logo } from '@/components/Logo';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, router]);

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/api/v1/wallets/me/balance').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/v1/notifications', { params: { limit: 5 } }).then((r) => r.data),
    enabled: isAuthenticated,
  });

  const isSeller = user ? ['STALL_OWNER', 'ATTENDANT'].includes(user.role) : false;

  // Sellers with no merchant profile must complete setup first
  const { data: merchant, isLoading: merchantLoading } = useQuery({
    queryKey: ['my-merchant'],
    queryFn: () => api.get('/api/v1/merchants/me').then((r) => r.data).catch(() => null),
    enabled: isAuthenticated && isSeller,
  });

  useEffect(() => {
    if (isSeller && !merchantLoading && merchant === null) {
      router.push('/seller/setup');
    }
  }, [isSeller, merchant, merchantLoading, router]);

  if (!user) return null;
  if (isSeller && merchantLoading) return null;
  const isAdmin = ['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'].includes(user.role);
  const isAgent = user.role === 'FIELD_AGENT';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size={30} />
          <div className="flex items-center gap-4">
            <Link href="/notifications" className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors">
              <Bell className="w-5 h-5 text-navy-600" />
              {(notifications?.unreadCount ?? 0) > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-brand-red text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {notifications.unreadCount}
                </span>
              )}
            </Link>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-3 rounded-xl p-1 hover:bg-gray-50 transition-colors"
              >
                <div className="w-9 h-9 bg-gradient-to-br from-brand-blue to-brand-green rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </div>
                <div className="text-sm text-right hidden sm:block">
                  <div className="font-bold text-navy-700">{user.firstName} {user.lastName}</div>
                  <div className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ').toLowerCase()}</div>
                </div>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-50">
                  <button
                    onClick={() => { logout(); router.push('/auth/login'); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-brand-red font-semibold hover:bg-red-50 transition-colors rounded-2xl"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 pb-safe">
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-navy-700">Hi, {user.firstName}</h1>
          <p className="text-sm text-gray-500">Here&apos;s your Mall263 overview</p>
        </div>

        {/* Wallet Card */}
        <div className="rounded-2xl bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 text-white p-6 mb-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #F7941D 0%, transparent 50%)' }} />
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-white/60 font-medium">Available Balance</p>
                <p className="text-4xl font-black mt-1">{formatCurrency(parseFloat(wallet?.available ?? '0'))}</p>
              </div>
              <Wallet className="w-10 h-10 text-white/20" />
            </div>
            {parseFloat(wallet?.locked ?? '0') > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-white/50 mb-4">
                <Lock className="w-3 h-3" /> Locked: {formatCurrency(parseFloat(wallet?.locked ?? '0'))}
              </div>
            )}
            <div className="flex gap-3">
              <Link href="/wallet/deposit" className="flex items-center gap-2 bg-brand-orange hover:bg-orange-500 text-white text-sm font-bold py-2.5 px-5 rounded-xl transition-all shadow-md">
                <ArrowDownLeft className="w-4 h-4" /> Deposit
              </Link>
              <Link href="/wallet/history" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2.5 px-5 rounded-xl transition-colors">
                <ArrowUpRight className="w-4 h-4" /> History
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="font-black text-lg text-navy-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Link href="/marketplace" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-blue hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-blue group-hover:text-white transition-colors">
              <ShoppingCart className="w-6 h-6 text-brand-blue group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-bold text-navy-700">Browse</span>
          </Link>
          <Link href="/demands" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-orange hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-orange group-hover:text-white transition-colors">
              <Gavel className="w-6 h-6 text-brand-orange group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-bold text-navy-700">Demands</span>
          </Link>

          {isSeller && (
            <>
              <Link href="/pos" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-green hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-green group-hover:text-white transition-colors">
                  <Store className="w-6 h-6 text-brand-green group-hover:text-white transition-colors" />
                </div>
                <span className="text-sm font-bold text-navy-700">POS</span>
              </Link>
              <Link href="/inventory" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-yellow hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-yellow transition-colors">
                  <Package className="w-6 h-6 text-brand-yellow" />
                </div>
                <span className="text-sm font-bold text-navy-700">Inventory</span>
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <Link href="/admin" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-red hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-red group-hover:text-white transition-colors">
                  <Settings className="w-6 h-6 text-brand-red group-hover:text-white transition-colors" />
                </div>
                <span className="text-sm font-bold text-navy-700">Admin</span>
              </Link>
              <Link href="/reports" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-blue hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-blue group-hover:text-white transition-colors">
                  <BarChart3 className="w-6 h-6 text-brand-blue group-hover:text-white transition-colors" />
                </div>
                <span className="text-sm font-bold text-navy-700">Reports</span>
              </Link>
            </>
          )}

          {isAgent && (
            <>
              <Link href="/agent" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-blue hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-blue group-hover:text-white transition-colors">
                  <Users className="w-6 h-6 text-brand-blue group-hover:text-white transition-colors" />
                </div>
                <span className="text-sm font-bold text-navy-700">Agent Tasks</span>
              </Link>
              <Link href="/inventory" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-yellow hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-yellow transition-colors">
                  <Package className="w-6 h-6 text-brand-yellow" />
                </div>
                <span className="text-sm font-bold text-navy-700">Stock</span>
              </Link>
            </>
          )}

          {!isSeller && !isAdmin && !isAgent && (
            <Link href="/demands/new" className="bg-white rounded-2xl p-5 border-2 border-gray-100 hover:border-brand-green hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-green group-hover:text-white transition-colors">
                <PlusCircle className="w-6 h-6 text-brand-green group-hover:text-white transition-colors" />
              </div>
              <span className="text-sm font-bold text-navy-700">Post Demand</span>
            </Link>
          )}
        </div>

        {/* Recent Notifications */}
        <h2 className="font-black text-lg text-navy-700 mb-3">Recent Activity</h2>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {(notifications?.data || []).length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {(notifications?.data || []).map((n: any) => (
                <div key={n.id} className={`px-5 py-4 flex items-center gap-3 ${!n.isRead ? 'bg-orange-50/30' : ''}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-brand-orange' : 'bg-gray-200'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-navy-700 truncate">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
          <Link href="/notifications" className="block text-center text-sm text-brand-orange font-bold py-3 border-t border-gray-100 hover:bg-orange-50/30 transition-colors">
            View all notifications
          </Link>
        </div>
      </div>
    </div>
  );
}
