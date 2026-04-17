'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isWalletTxCredit, walletTxTypeLabel } from '@mall263/shared';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Loader2, Lock, List, Wallet } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuthStore } from '@/lib/store';

function txIcon(type: string) {
  if (isWalletTxCredit(type)) return <ArrowDownLeft className="w-4 h-4 text-brand-green" />;
  if (type === 'BID_LOCK') return <Lock className="w-4 h-4 text-gray-400" />;
  return <ArrowUpRight className="w-4 h-4 text-brand-red" />;
}

function txAmountSign(type: string) {
  return isWalletTxCredit(type) ? '+' : '−';
}

export default function WalletOverviewPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/auth/login');
  }, [authLoading, isAuthenticated, router]);

  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api.get('/api/v1/wallets/me/balance').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['wallet-transactions-preview'],
    queryFn: () => api.get('/api/v1/wallets/me/transactions', { params: { limit: 8, page: 1 } }).then((r) => r.data),
    enabled: isAuthenticated,
  });

  const preview: any[] = txData?.data ?? [];

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
            <h1 className="text-lg font-black text-navy-700">Wallet</h1>
            <p className="text-xs text-gray-500">Balances & recent activity</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24 sm:pb-6 space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 text-white p-5">
          {balLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 text-white/80 animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-sm text-white/60 mb-1">Available</p>
              <p className="text-3xl font-black">{formatCurrency(parseFloat(balance?.available ?? '0'))}</p>
              {parseFloat(balance?.locked ?? '0') > 0 && (
                <p className="text-sm text-white/70 mt-2 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Locked{' '}
                  {formatCurrency(parseFloat(balance?.locked ?? '0'))}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-5">
                <Link
                  href="/wallet/deposit"
                  className="inline-flex items-center gap-2 bg-brand-orange text-white text-sm font-bold py-2.5 px-4 rounded-xl"
                >
                  <Wallet className="w-4 h-4" /> Top up
                </Link>
                <Link
                  href="/wallet/history"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-2.5 px-4 rounded-xl"
                >
                  <List className="w-4 h-4" /> Full history
                </Link>
              </div>
            </>
          )}
        </div>

        <div>
          <h2 className="text-sm font-black text-navy-700 uppercase tracking-wide mb-3">Recent transactions</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {txLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
              </div>
            ) : preview.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No transactions yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {preview.map((tx: any) => {
                  const label = walletTxTypeLabel(tx.type);
                  const sign = txAmountSign(tx.type);
                  return (
                    <div key={tx.id} className="px-5 py-3.5 flex items-center gap-3">
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
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div
                        className={`font-black text-sm flex-shrink-0 ${
                          isWalletTxCredit(tx.type) ? 'text-brand-green' : 'text-brand-red'
                        }`}
                      >
                        {sign}
                        {formatCurrency(parseFloat(tx.amount))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Link
              href="/wallet/history"
              className="block text-center text-sm font-bold text-brand-orange py-3 border-t border-gray-50 hover:bg-gray-50"
            >
              View all transactions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
