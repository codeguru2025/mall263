'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isWalletTxCredit, walletTxTypeLabel } from '@mall263/shared';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, RefreshCw, Loader2, Lock } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/lib/store';

/** Tailwind colour classes — labels come from `@mall263/shared` for parity with mobile. */
const TYPE_COLORS: Record<string, string> = {
  DEPOSIT: 'text-brand-green',
  WITHDRAWAL: 'text-brand-red',
  TRANSFER_IN: 'text-brand-green',
  TRANSFER_OUT: 'text-brand-red',
  COMMISSION_DEDUCTION: 'text-brand-red',
  COMMISSION_RESERVE: 'text-brand-red',
  BID_LOCK: 'text-gray-500',
  BID_UNLOCK: 'text-brand-green',
  BID_FORFEIT: 'text-brand-red',
  PURCHASE_DEBIT: 'text-brand-red',
  SALE_CREDIT: 'text-brand-green',
  REFUND_CREDIT: 'text-brand-green',
  REFUND_DEBIT: 'text-brand-red',
  FEE: 'text-brand-red',
  ADJUSTMENT: 'text-brand-green',
};

function txIcon(type: string) {
  if (isWalletTxCredit(type)) return <ArrowDownLeft className="w-4 h-4 text-brand-green" />;
  if (type === 'BID_LOCK') return <RefreshCw className="w-4 h-4 text-gray-400" />;
  return <ArrowUpRight className="w-4 h-4 text-brand-red" />;
}

function txAmountSign(type: string) {
  return isWalletTxCredit(type) ? '+' : '−';
}

export default function WalletHistoryPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => api.get('/api/v1/wallets/me/transactions', { params: { limit: 50 } }).then((r) => r.data),
  });

  const { data: balance } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/api/v1/wallets/me/balance').then((r) => r.data),
  });

  const transactions: any[] = data?.data ?? [];

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/wallet" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-navy-700" />
          </Link>
          <Logo size={30} />
          <div>
            <h1 className="text-lg font-black text-navy-700">Wallet History</h1>
            <p className="text-xs text-gray-500">All transactions</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24 sm:pb-6">
        {/* Balance summary */}
        <div className="rounded-2xl bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 text-white p-5 mb-6">
          <p className="text-sm text-white/60 mb-1">Available Balance</p>
          <p className="text-3xl font-black">{formatCurrency(parseFloat(balance?.available ?? '0'))}</p>
          {parseFloat(balance?.locked ?? '0') > 0 && (
            <p className="text-sm text-white/70 mt-2 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Locked: {formatCurrency(parseFloat(balance?.locked ?? '0'))}
            </p>
          )}
          <div className="flex flex-wrap gap-3 mt-4">
            <Link
              href="/wallet/deposit"
              className="inline-flex items-center gap-2 bg-brand-orange text-white text-sm font-bold py-2 px-4 rounded-xl"
            >
              <ArrowDownLeft className="w-4 h-4" /> Deposit
            </Link>
            <Link
              href="/wallet"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2 px-4 rounded-xl"
            >
              Wallet overview
            </Link>
          </div>
        </div>

        {/* Transaction list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map((tx: any) => {
                const label = walletTxTypeLabel(tx.type);
                const colorClass = TYPE_COLORS[tx.type] ?? 'text-navy-700';
                const sign = txAmountSign(tx.type);
                return (
                  <div key={tx.id} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                      {txIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-navy-700 truncate">
                        {tx.description?.trim() || label}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {label} ·{' '}
                        {new Date(tx.createdAt).toLocaleDateString('en-ZW', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className={`font-black text-sm flex-shrink-0 ${colorClass}`}>
                      {sign}
                      {formatCurrency(parseFloat(tx.amount))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
