'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { getStaffHomePath, isStaffAdminRole } from '@mall263/shared';
import { useAuthStore } from '@/lib/store';
import { useHaptic } from '@/lib/hooks/useHaptic';
import { Home, Search, Gavel, Wallet, LayoutDashboard, Store, Package, BarChart3, Shield, Users, Settings, Sparkles, MapPin } from 'lucide-react';

const CUSTOMER_TABS = [
  { href: '/',               icon: Home,            label: 'Home' },
  { href: '/for-you',       icon: Sparkles,        label: 'For You' },
  { href: '/marketplace',    icon: Search,          label: 'Browse' },
  { href: '/demands',        icon: Gavel,           label: 'Demands' },
  { href: '/wallet',         icon: Wallet,          label: 'Wallet' },
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Account' },
];

const SELLER_TABS = [
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Home' },
  { href: '/pos',            icon: Store,           label: 'POS' },
  { href: '/demands',        icon: Gavel,           label: 'Demands' },
  { href: '/wallet',         icon: Wallet,          label: 'Wallet' },
  { href: '/inventory',      icon: Package,         label: 'Stock' },
  { href: '/seller/reports', icon: BarChart3,       label: 'Reports' },
];

function adminTabsForUser(role: string | undefined) {
  const consoleHref = role && isStaffAdminRole(role) ? (getStaffHomePath(role) ?? '/admin') : '/admin';
  return [
    { href: consoleHref,         icon: Shield,          label: 'Console' },
    { href: '/admin/users',     icon: Users,            label: 'Users' },
    { href: '/admin/merchants', icon: Store,            label: 'Merchants' },
    { href: '/reports',         icon: BarChart3,        label: 'Reports' },
    { href: '/admin/settings',  icon: Settings,         label: 'Settings' },
  ];
}

/** Field agents: core workflows without seller POS/inventory. */
const AGENT_TABS = [
  { href: '/dashboard',      icon: LayoutDashboard, label: 'Home' },
  { href: '/agent',          icon: MapPin,          label: 'Agent' },
  { href: '/marketplace',    icon: Search,          label: 'Browse' },
  { href: '/wallet',         icon: Wallet,          label: 'Wallet' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const haptic = useHaptic();

  const hide = ['/auth/', '/wallet/deposit/return', '/chat/', '/services/new'].some((p) => pathname.startsWith(p));
  if (hide) return null;

  const isSeller = user ? ['STALL_OWNER', 'ATTENDANT'].includes(user.role) : false;
  const isAdminConsole = user ? isStaffAdminRole(user.role) : false;
  const isFieldAgent = user?.role === 'FIELD_AGENT';
  const TABS = isAdminConsole
    ? adminTabsForUser(user?.role)
    : isSeller
      ? SELLER_TABS
      : isFieldAgent
        ? AGENT_TABS
        : CUSTOMER_TABS;
  const WALLET_HREF = '/wallet';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white border-t border-gray-100 safe-area-bottom">
      <div className="flex items-stretch">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          const isWalletTab = href === WALLET_HREF && !isAdminConsole;

          if (isWalletTab) {
            return (
              <Link
                key={href}
                href={isAuthenticated ? href : '/auth/login'}
                onClick={() => haptic.medium()}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative -top-3"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="w-14 h-14 bg-brand-orange rounded-full flex items-center justify-center shadow-lg shadow-orange-200 border-4 border-white"
                >
                  <Icon className="w-6 h-6 text-white" />
                </motion.div>
                <span className="text-[10px] font-bold text-brand-orange mt-0.5">Wallet</span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
                href={
                !isAuthenticated &&
                href !== '/' &&
                href !== '/marketplace' &&
                href !== '/for-you' &&
                href !== '/services' &&
                href !== '/demands' &&
                href !== '/wallet' &&
                href !== '/agent'
                  ? '/auth/login'
                  : href
              }
              onClick={() => haptic.light()}
              className={`relative flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                active ? 'text-brand-orange' : 'text-gray-400'
              }`}
            >
              <motion.div whileTap={{ scale: 0.85 }}>
                <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`} />
              </motion.div>
              <span className={`text-[10px] font-semibold ${active ? 'font-bold' : ''}`}>{label}</span>
              {active && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 w-6 h-0.5 bg-brand-orange rounded-full"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
