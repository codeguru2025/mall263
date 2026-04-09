'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, RefreshCw, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/lib/store';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DEPOSIT:              { label: 'Deposit',             color: 'text-brand-green' },
  WITHDRAWAL:           { label: 'Withdrawal',          color: 'text-brand-red' },
  COMMISSION_DEDUCTION: { label: 'Commission',          color: 'text-brand-red' },
  BID_LOCK:             { label: 'Bid Locked',          color: 'text-gray-500' },
  BID_UNLOCK:           { label: 'Bid Unlocked',        color: 'text-brand-green' },
  REFUND_CREDIT:        { label: 'Refund Credit',       color: 'text-brand-green' },
  ADJUSTMENT:           { label: 'Adjustment',          color: 'text-brand-green' },
  TRANSFER:             { label: 'Transfer',            color: 'text-navy-700' },
};

const CREDIT_TYPES = ['DEPOSIT', 'BID_UNLOCK', 'REFUND_CREDIT', 'ADJUSTMENT'];

function txIcon(type: string) {
  if (CREDIT_TYPES.includes(type)) return <ArrowDownLeft className="w-4 h-4 text-brand-green" />;
  if (type === 'BID_LOCK') return <RefreshCw className="w-4 h-4 text-gray-400" />;
  return <ArrowUpRight className="w-4 h-4 text-brand-red" />;
}

function txAmountSign(type: string) {
  return CREDIT_TYPES.includes(type) ? '+' : '-';
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
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
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
          <Link href="/wallet/deposit" className="mt-4 inline-flex items-center gap-2 bg-brand-orange text-white text-sm font-bold py-2 px-4 rounded-xl">
            <ArrowDownLeft className="w-4 h-4" /> Deposit
          </Link>
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
                const meta = TYPE_LABELS[tx.type] ?? { label: tx.type, color: 'text-navy-700' };
                const sign = txAmountSign(tx.type);
                return (
                  <div key={tx.id} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                      {txIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-navy-700 truncate">
                        {tx.description || meta.label}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString('en-ZW', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className={`font-black text-sm flex-shrink-0 ${meta.color}`}>
                      {sign}{formatCurrency(parseFloat(tx.amount))}
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
