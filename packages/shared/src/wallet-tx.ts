/**
 * Wallet transaction display rules — keep web + mobile in sync with backend
 * `WalletTransactionType` (Prisma).
 */

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRANSFER_IN: 'Transfer in',
  TRANSFER_OUT: 'Transfer out',
  COMMISSION_DEDUCTION: 'Commission',
  COMMISSION_RESERVE: 'Commission reserve',
  BID_LOCK: 'Bid locked',
  BID_UNLOCK: 'Bid unlocked',
  BID_FORFEIT: 'Bid forfeited',
  PURCHASE_DEBIT: 'Purchase',
  SALE_CREDIT: 'Sale',
  REFUND_CREDIT: 'Refund',
  REFUND_DEBIT: 'Refund debit',
  FEE: 'Fee',
  ADJUSTMENT: 'Adjustment',
};

/** Types that increase available balance in the UI (+ prefix). */
const CREDIT_TYPES = new Set<string>([
  'DEPOSIT',
  'BID_UNLOCK',
  'REFUND_CREDIT',
  'ADJUSTMENT',
  'TRANSFER_IN',
  'SALE_CREDIT',
]);

export function walletTxTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function isWalletTxCredit(type: string): boolean {
  return CREDIT_TYPES.has(type);
}
