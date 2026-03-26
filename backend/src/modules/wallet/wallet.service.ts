import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletTransactionType, WalletTransactionStatus, WalletLockReason, WalletLockStatus, Prisma } from '@prisma/client';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class WalletService {
  private readonly COMMISSION_RATE = 0.025;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

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
   * In production, this would be triggered by payment gateway callback (EcoCash, InnBucks, etc.)
   */
  async deposit(userId: string, amount: number, externalRef?: string, description?: string) {
    if (amount <= 0) throw new BadRequestException('Deposit amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      if (!wallet.isActive) throw new BadRequestException('Wallet is inactive');

      const balanceBefore = wallet.availableBalance;
      const balanceAfter = new Prisma.Decimal(balanceBefore.toString()).add(amount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: balanceAfter,
          lastActivityAt: new Date(),
        },
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
    });
  }

  /**
   * Lock funds for a bid (10% rule enforcement).
   * Buyer must have >= 10% of intended purchase value.
   */
  async lockFundsForBid(userId: string, bidAmount: number, referenceId: string) {
    const lockAmount = bidAmount * 0.10; // 10% of bid value

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const available = parseFloat(wallet.availableBalance.toString());
      if (available < lockAmount) {
        throw new BadRequestException(
          `Insufficient funds. Need $${lockAmount.toFixed(2)} (10% of $${bidAmount.toFixed(2)}). Available: $${available.toFixed(2)}`
        );
      }

      const newAvailable = new Prisma.Decimal(available - lockAmount);
      const newLocked = new Prisma.Decimal(parseFloat(wallet.lockedBalance.toString()) + lockAmount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: newAvailable,
          lockedBalance: newLocked,
          lastActivityAt: new Date(),
        },
      });

      const lock = await tx.walletLock.create({
        data: {
          walletId: wallet.id,
          amount: new Prisma.Decimal(lockAmount),
          reason: WalletLockReason.BID,
          status: WalletLockStatus.ACTIVE,
          referenceId,
          referenceType: 'buyer_demand',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.BID_LOCK,
          amount: new Prisma.Decimal(lockAmount),
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
    });
  }

  /**
   * Release locked funds (bid rejected/expired).
   */
  async releaseLock(lockId: string) {
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.walletLock.findUnique({ where: { id: lockId } });
      if (!lock || lock.status !== WalletLockStatus.ACTIVE) {
        throw new BadRequestException('Lock not found or already released');
      }

      const wallet = await tx.wallet.findUnique({ where: { id: lock.walletId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const lockAmount = parseFloat(lock.amount.toString());
      const newAvailable = new Prisma.Decimal(parseFloat(wallet.availableBalance.toString()) + lockAmount);
      const newLocked = new Prisma.Decimal(parseFloat(wallet.lockedBalance.toString()) - lockAmount);

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

      return { released: true, amount: lockAmount };
    });
  }

  /**
   * Check if seller has sufficient commission balance for a sale.
   * Seller MUST have >= 2.5% of sale amount in wallet.
   */
  async checkCommissionBalance(sellerUserId: string, saleAmount: number): Promise<{ sufficient: boolean; required: number; available: number }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: sellerUserId } });
    if (!wallet) throw new NotFoundException('Seller wallet not found');

    const required = saleAmount * this.COMMISSION_RATE;
    const available = parseFloat(wallet.availableBalance.toString());

    return { sufficient: available >= required, required, available };
  }

  /**
   * Deduct commission from seller wallet after a POS sale.
   * This is called DURING the sale transaction — if insufficient, sale is BLOCKED.
   */
  async deductCommission(sellerUserId: string, saleAmount: number, saleId: string) {
    const commissionAmount = saleAmount * this.COMMISSION_RATE;

    return this.prisma.$transaction(async (tx) => {
      // Row-level lock on wallet to prevent race conditions
      const wallet = await tx.wallet.findUnique({ where: { userId: sellerUserId } });
      if (!wallet) throw new NotFoundException('Seller wallet not found');

      const available = parseFloat(wallet.availableBalance.toString());
      if (available < commissionAmount) {
        throw new BadRequestException(
          `Insufficient commission balance. Sale of $${saleAmount.toFixed(2)} requires $${commissionAmount.toFixed(2)} commission. Available: $${available.toFixed(2)}. Please fund your wallet.`
        );
      }

      const newBalance = new Prisma.Decimal(available - commissionAmount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: newBalance, lastActivityAt: new Date() },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.COMMISSION_DEDUCTION,
          amount: new Prisma.Decimal(commissionAmount),
          balanceBefore: wallet.availableBalance,
          balanceAfter: newBalance,
          status: WalletTransactionStatus.COMPLETED,
          description: `Commission for sale ${saleId} (${this.COMMISSION_RATE * 100}% of $${saleAmount.toFixed(2)})`,
          referenceId: saleId,
          referenceType: 'pos_sale',
          completedAt: new Date(),
        },
      });

      return { commissionDeducted: commissionAmount, newBalance };
    });
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
    return { tier: balance > 0 ? 'FUNDED' : 'FREE', balance };
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
   */
  async requestWithdrawal(userId: string, amount: number, description?: string) {
    if (amount <= 0) throw new BadRequestException('Withdrawal amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const available = parseFloat(wallet.availableBalance.toString());
      if (available < amount) {
        throw new BadRequestException(`Insufficient balance. Available: $${available.toFixed(2)}`);
      }

      const newBalance = new Prisma.Decimal(available - amount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: newBalance, lastActivityAt: new Date() },
      });

      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.WITHDRAWAL,
          amount: new Prisma.Decimal(amount),
          balanceBefore: wallet.availableBalance,
          balanceAfter: newBalance,
          status: WalletTransactionStatus.PENDING,
          description: description || 'Withdrawal request',
          completedAt: null,
        },
      });
    });
  }
}
