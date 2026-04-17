import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletTransactionType, WalletTransactionStatus, WalletLockReason, WalletLockStatus, Prisma } from '@prisma/client';

@Injectable()
export class WalletService {
  private readonly COMMISSION_RATE = 0.025;

  constructor(private prisma: PrismaService) {}

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: { take: 20, orderBy: { createdAt: 'desc' } },
        locks: { where: { status: WalletLockStatus.ACTIVE } },
      },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return {
      available: wallet.availableBalance,
      locked: wallet.lockedBalance,
      total: new Prisma.Decimal(wallet.availableBalance.toString()).add(wallet.lockedBalance),
      currency: wallet.currency,
    };
  }

  /**
   * Deposit funds into wallet.
   *
   * IDEMPOTENCY: If externalRef is provided (payment gateway webhook), we first
   * check whether a transaction with that ref already exists. If it does, we
   * return the original transaction without double-crediting. This means it is
   * safe to retry or replay the webhook — the second call is a no-op.
   *
   * ATOMICITY: Balance update and transaction record are in one RepeatableRead
   * transaction. Retries automatically on write conflicts (P2034/P2002).
   */
  async deposit(userId: string, amount: number, externalRef?: string, description?: string) {
    if (amount <= 0) throw new BadRequestException('Deposit amount must be positive');

    // Idempotency check for payment gateway webhooks
    if (externalRef) {
      const existing = await this.prisma.walletTransaction.findFirst({
        where: { externalRef, type: WalletTransactionType.DEPOSIT },
      });
      if (existing) {
        return { transaction: existing, newBalance: null, idempotent: true };
      }
    }

    return this.prisma.$retryTransaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new NotFoundException('Wallet not found');
        if (!wallet.isActive) throw new BadRequestException('Wallet is inactive');

        // Second idempotency check inside the transaction (race-safe)
        if (externalRef) {
          const existing = await tx.walletTransaction.findFirst({
            where: { externalRef, type: WalletTransactionType.DEPOSIT },
          });
          if (existing) return { transaction: existing, newBalance: null, idempotent: true };
        }

        const balanceBefore = wallet.availableBalance;
        const balanceAfter = new Prisma.Decimal(balanceBefore.toString()).add(amount);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: balanceAfter, lastActivityAt: new Date() },
        });

        const transaction = await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.DEPOSIT,
            amount: new Prisma.Decimal(amount),
            balanceBefore,
            balanceAfter,
            status: WalletTransactionStatus.COMPLETED,
            description: description || 'Wallet deposit',
            externalRef,
            completedAt: new Date(),
          },
        });

        return { transaction, newBalance: balanceAfter };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Used by payment polling when Redis pending key expired but wallet was already credited. */
  async hasCompletedDepositByExternalRef(externalRef: string): Promise<boolean> {
    const row = await this.prisma.walletTransaction.findFirst({
      where: {
        externalRef,
        type: WalletTransactionType.DEPOSIT,
        status: WalletTransactionStatus.COMPLETED,
      },
    });
    return !!row;
  }

  /**
   * Lock funds for a bid (10% rule enforcement).
   * REPEATABLE READ ensures the balance we read is stable throughout the transaction.
   */
  async lockFundsForBid(userId: string, bidAmount: number, referenceId: string) {
    const lockAmountDec = new Prisma.Decimal(bidAmount).mul('0.10');

    return this.prisma.$retryTransaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new NotFoundException('Wallet not found');

        if (wallet.availableBalance.lessThan(lockAmountDec)) {
          throw new BadRequestException(
            `Insufficient funds. Need $${lockAmountDec.toFixed(2)} (10% of $${bidAmount.toFixed(2)}). Available: $${wallet.availableBalance.toFixed(2)}`,
          );
        }

        const newAvailable = wallet.availableBalance.sub(lockAmountDec);
        const newLocked = wallet.lockedBalance.add(lockAmountDec);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: newAvailable, lockedBalance: newLocked, lastActivityAt: new Date() },
        });

        const lock = await tx.walletLock.create({
          data: {
            walletId: wallet.id,
            amount: lockAmountDec,
            reason: WalletLockReason.BID,
            status: WalletLockStatus.ACTIVE,
            referenceId,
            referenceType: 'buyer_demand',
            expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour — matches BID_LOCK_HOURS in demands.service
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.BID_LOCK,
            amount: lockAmountDec,
            balanceBefore: wallet.availableBalance,
            balanceAfter: newAvailable,
            status: WalletTransactionStatus.COMPLETED,
            description: `Bid lock for demand ${referenceId}`,
            referenceId,
            referenceType: 'wallet_lock',
            completedAt: new Date(),
          },
        });

        return lock;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /**
   * Release locked funds (bid rejected/expired).
   * Guard against negative lockedBalance if data is inconsistent.
   */
  async releaseLock(lockId: string) {
    return this.prisma.$retryTransaction(
      async (tx) => {
        const lock = await tx.walletLock.findUnique({ where: { id: lockId } });
        if (!lock || lock.status !== WalletLockStatus.ACTIVE) {
          throw new BadRequestException('Lock not found or already released');
        }

        const wallet = await tx.wallet.findUnique({ where: { id: lock.walletId } });
        if (!wallet) throw new NotFoundException('Wallet not found');

        // Consistency guard: locked balance must never go negative
        if (wallet.lockedBalance.lessThan(lock.amount)) {
          throw new BadRequestException(
            `Cannot release lock: locked balance ($${wallet.lockedBalance.toFixed(2)}) is less than lock amount ($${lock.amount.toFixed(2)})`,
          );
        }

        const newAvailable = wallet.availableBalance.add(lock.amount);
        const newLocked = wallet.lockedBalance.sub(lock.amount);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: newAvailable, lockedBalance: newLocked, lastActivityAt: new Date() },
        });

        await tx.walletLock.update({
          where: { id: lockId },
          data: { status: WalletLockStatus.RELEASED, releasedAt: new Date() },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.BID_UNLOCK,
            amount: lock.amount,
            balanceBefore: wallet.availableBalance,
            balanceAfter: newAvailable,
            status: WalletTransactionStatus.COMPLETED,
            description: `Bid lock released`,
            referenceId: lock.referenceId,
            referenceType: 'wallet_lock',
            completedAt: new Date(),
          },
        });

        return { released: true, amount: lock.amount };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /**
   * UI-ONLY balance preview — NOT used for business logic enforcement.
   * This is a stale read (no transaction) and is intentionally non-blocking.
   * The real balance check happens INSIDE the Serializable transaction in
   * pos.service.ts processSale() — that is the ACID-safe enforcement point.
   * Never use this result to gate a write operation.
   */
  async checkCommissionBalance(sellerUserId: string, saleAmount: number): Promise<{ sufficient: boolean; required: number; available: number }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: sellerUserId } });
    if (!wallet) throw new NotFoundException('Seller wallet not found');

    const saleDec = new Prisma.Decimal(saleAmount);
    const requiredDec = saleDec.mul(this.COMMISSION_RATE.toString());
    const availableDec = wallet.availableBalance;

    return {
      sufficient: availableDec.gte(requiredDec),
      required: parseFloat(requiredDec.toFixed(2)),
      available: parseFloat(availableDec.toFixed(2)),
    };
  }

  /**
   * Deduct commission from seller wallet.
   * Prefer using the inlined tx version in pos.service for atomic POS sales.
   * This standalone version is suitable for direct API calls or other contexts.
   */
  async deductCommission(sellerUserId: string, saleAmount: number, saleId: string) {
    const commissionDec = new Prisma.Decimal(saleAmount).mul(this.COMMISSION_RATE.toString());

    return this.prisma.$retryTransaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId: sellerUserId } });
        if (!wallet) throw new NotFoundException('Seller wallet not found');

        if (wallet.availableBalance.lessThan(commissionDec)) {
          throw new BadRequestException(
            `Insufficient commission balance. Sale of $${saleAmount.toFixed(2)} requires $${commissionDec.toFixed(2)} commission. Available: $${wallet.availableBalance.toFixed(2)}. Please fund your wallet.`,
          );
        }

        const newBalance = wallet.availableBalance.sub(commissionDec);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: newBalance, lastActivityAt: new Date() },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.COMMISSION_DEDUCTION,
            amount: commissionDec,
            balanceBefore: wallet.availableBalance,
            balanceAfter: newBalance,
            status: WalletTransactionStatus.COMPLETED,
            description: `Commission for sale ${saleId} (${this.COMMISSION_RATE * 100}% of $${saleAmount.toFixed(2)})`,
            referenceId: saleId,
            referenceType: 'pos_sale',
            completedAt: new Date(),
          },
        });

        return { commissionDeducted: commissionDec.toNumber(), newBalance };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /**
   * Get wallet transaction history with pagination.
   */
  async getTransactions(userId: string, params: {
    type?: WalletTransactionType;
    page?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { type, page = 1, limit = 20, startDate, endDate } = params;
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const where: any = { walletId: wallet.id };
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Check buyer's buying power tier.
   */
  async getBuyingPowerTier(userId: string): Promise<{ tier: 'FREE' | 'FUNDED' | 'ACTIVE_BUYER'; balance: number }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return { tier: 'FREE', balance: 0 };

    const balance = parseFloat(wallet.availableBalance.toString());
    if (balance <= 0) return { tier: 'FREE', balance: 0 };

    // ACTIVE_BUYER: funded AND has at least one completed transaction (i.e., has actually used the platform)
    const completedTxCount = await this.prisma.walletTransaction.count({
      where: { walletId: wallet.id, status: WalletTransactionStatus.COMPLETED },
    });
    if (completedTxCount > 0) return { tier: 'ACTIVE_BUYER', balance };
    return { tier: 'FUNDED', balance };
  }

  /**
   * Check if buyer can place a bid (ACTIVE BUYER check: 10% rule).
   */
  async canPlaceBid(userId: string, targetAmount: number): Promise<{ allowed: boolean; required: number; available: number }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) return { allowed: false, required: targetAmount * 0.1, available: 0 };

    const available = parseFloat(wallet.availableBalance.toString());
    const required = targetAmount * 0.1;

    return { allowed: available >= required, required, available };
  }

  /**
   * Process withdrawal request.
   *
   * Balance is deducted immediately and the transaction is set to PENDING.
   * The payment processor then either calls completeWithdrawal() on success
   * or failWithdrawal() on failure (which reverses the deduction).
   * This two-phase approach means the user cannot spend funds that are
   * in-flight to their bank account.
   *
   * ATOMICITY: Balance deduction and PENDING record are in one transaction.
   */
  async requestWithdrawal(userId: string, amount: number, description?: string) {
    if (amount <= 0) throw new BadRequestException('Withdrawal amount must be positive');

    return this.prisma.$retryTransaction(
      async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new NotFoundException('Wallet not found');
        if (!wallet.isActive) throw new BadRequestException('Wallet is inactive');

        const amountDec = new Prisma.Decimal(amount);
        if (wallet.availableBalance.lessThan(amountDec)) {
          throw new BadRequestException(`Insufficient balance. Available: $${wallet.availableBalance.toFixed(2)}`);
        }

        const newBalance = wallet.availableBalance.sub(amountDec);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: newBalance, lastActivityAt: new Date() },
        });

        return tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.WITHDRAWAL,
            amount: amountDec,
            balanceBefore: wallet.availableBalance,
            balanceAfter: newBalance,
            status: WalletTransactionStatus.PENDING,
            description: description || 'Withdrawal request',
            completedAt: null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /**
   * Mark a PENDING withdrawal as COMPLETED (called by payment processor webhook).
   *
   * ATOMICITY: Status check and update are in one RepeatableRead transaction
   * to prevent TOCTOU race from duplicate webhook deliveries.
   */
  async completeWithdrawal(transactionId: string, externalRef?: string) {
    return this.prisma.$retryTransaction(
      async (tx) => {
        const wtx = await tx.walletTransaction.findUnique({ where: { id: transactionId } });
        if (!wtx) throw new NotFoundException('Transaction not found');
        if (wtx.status !== WalletTransactionStatus.PENDING) {
          throw new BadRequestException('Transaction is not pending');
        }
        if (wtx.type !== WalletTransactionType.WITHDRAWAL) {
          throw new BadRequestException('Transaction is not a withdrawal');
        }

        return tx.walletTransaction.update({
          where: { id: transactionId },
          data: { status: WalletTransactionStatus.COMPLETED, completedAt: new Date(), externalRef },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /**
   * Reverse a FAILED withdrawal — atomically returns funds to availableBalance
   * and marks the transaction FAILED. Called when the payment processor reports
   * a failure (e.g. invalid bank account, insufficient bank funds).
   *
   * ATOMICITY: Balance restore and status update are in one RepeatableRead
   * transaction so a crash mid-way does not leave the user short-changed.
   */
  async failWithdrawal(transactionId: string, reason: string) {
    return this.prisma.$retryTransaction(
      async (tx) => {
        const wtx = await tx.walletTransaction.findUnique({ where: { id: transactionId } });
        if (!wtx) throw new NotFoundException('Transaction not found');
        if (wtx.status !== WalletTransactionStatus.PENDING) {
          throw new BadRequestException('Transaction is not pending');
        }
        if (wtx.type !== WalletTransactionType.WITHDRAWAL) {
          throw new BadRequestException('Transaction is not a withdrawal');
        }

        const wallet = await tx.wallet.findUnique({ where: { id: wtx.walletId } });
        if (!wallet) throw new NotFoundException('Wallet not found');

        const refundedBalance = wallet.availableBalance.add(wtx.amount);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: refundedBalance, lastActivityAt: new Date() },
        });

        await tx.walletTransaction.update({
          where: { id: transactionId },
          data: { status: WalletTransactionStatus.FAILED, metadata: { failureReason: reason } },
        });

        // Record the reversal as a separate credit entry for the audit trail
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.ADJUSTMENT,
            amount: wtx.amount,
            balanceBefore: wallet.availableBalance,
            balanceAfter: refundedBalance,
            status: WalletTransactionStatus.COMPLETED,
            description: `Withdrawal reversal — payment failed: ${reason}`,
            referenceId: transactionId,
            referenceType: 'wallet_transaction',
            completedAt: new Date(),
          },
        });

        return { reversed: true, refundedAmount: wtx.amount };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  // ─── Escrow debit (buyer pays at job creation) ────────────────────────────

  async debitForEscrow(
    userId: string,
    amount: number,
    jobId: string,
    tx: Prisma.TransactionClient,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (Number(wallet.availableBalance) < amount) {
      throw new BadRequestException('Insufficient balance for escrow');
    }
    const balBefore = wallet.availableBalance;
    const balAfter = new Prisma.Decimal(Number(balBefore) - amount);
    await tx.wallet.update({
      where: { userId },
      data: { availableBalance: balAfter },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.ESCROW_LOCK,
        amount: new Prisma.Decimal(amount),
        status: WalletTransactionStatus.COMPLETED,
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: `Escrow lock for delivery job ${jobId}`,
        referenceId: jobId,
        referenceType: 'delivery_job',
      },
    });
  }

  // ─── Escrow release (seller paid on delivery) ─────────────────────────────

  async creditEscrowRelease(
    userId: string,
    amount: number,
    jobId: string,
    tx: Prisma.TransactionClient,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const balBefore = wallet.availableBalance;
    const balAfter = new Prisma.Decimal(Number(balBefore) + amount);
    await tx.wallet.update({
      where: { userId },
      data: { availableBalance: balAfter },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.ESCROW_RELEASE,
        amount: new Prisma.Decimal(amount),
        status: WalletTransactionStatus.COMPLETED,
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: `Escrow release for delivery job ${jobId}`,
        referenceId: jobId,
        referenceType: 'delivery_job',
      },
    });
  }

  // ─── Escrow refund (buyer gets money back) ────────────────────────────────

  async creditEscrowRefund(
    userId: string,
    amount: number,
    jobId: string,
    tx: Prisma.TransactionClient,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const balBefore = wallet.availableBalance;
    const balAfter = new Prisma.Decimal(Number(balBefore) + amount);
    await tx.wallet.update({
      where: { userId },
      data: { availableBalance: balAfter },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.ESCROW_REFUND,
        amount: new Prisma.Decimal(amount),
        status: WalletTransactionStatus.COMPLETED,
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: `Escrow refund for delivery job ${jobId}`,
        referenceId: jobId,
        referenceType: 'delivery_job',
      },
    });
  }

  // ─── Driver earning credit ────────────────────────────────────────────────

  async creditDriverEarning(
    userId: string,
    amount: number,
    jobId: string,
    tx: Prisma.TransactionClient,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) return; // driver may not have a wallet yet
    const balBefore = wallet.availableBalance;
    const balAfter = new Prisma.Decimal(Number(balBefore) + amount);
    await tx.wallet.update({
      where: { userId },
      data: { availableBalance: balAfter },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.DRIVER_EARNING,
        amount: new Prisma.Decimal(amount),
        status: WalletTransactionStatus.COMPLETED,
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: `Driver earning for delivery job ${jobId}`,
        referenceId: jobId,
        referenceType: 'delivery_job',
      },
    });
  }
}
