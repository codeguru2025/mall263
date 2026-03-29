import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus, WalletTransactionType, WalletTransactionStatus, Prisma } from '@prisma/client';

@Injectable()
export class TrustService {
  constructor(private prisma: PrismaService) {}

  async getScore(userId: string) {
    const score = await this.prisma.trustScore.findUnique({ where: { userId } });
    if (!score) throw new NotFoundException('Trust score not found');
    return score;
  }

  async recalculate(userId: string) {
    return this.prisma.$retryTransaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const wallet = await tx.wallet.findUnique({ where: { userId } });
        const deposits = await tx.walletTransaction.count({
          where: { walletId: wallet?.id, type: WalletTransactionType.DEPOSIT, status: WalletTransactionStatus.COMPLETED },
        });

        const fundingScore = Math.min(100, deposits * 10);

        let completionScore = 50;
        let cancellationScore = 50;
        let responseScore = 50;
        const accuracyScore = 50;
        let totalTransactions = 0;
        let totalCancellations = 0;

        if (user.role === UserRole.BUYER) {
          const demands = await tx.buyerDemand.findMany({ where: { buyerId: userId } });
          const matched = demands.filter(d => d.status === 'MATCHED').length;
          const cancelled = demands.filter(d => d.status === 'CANCELLED').length;
          totalTransactions = demands.length;
          totalCancellations = cancelled;
          completionScore = totalTransactions > 0 ? Math.round((matched / totalTransactions) * 100) : 50;
          cancellationScore = totalTransactions > 0 ? Math.round(100 - (cancelled / totalTransactions) * 100) : 50;
        } else if (user.role === UserRole.STALL_OWNER) {
          const merchant = await tx.merchant.findUnique({ where: { userId } });
          if (merchant) {
            const stalls = await tx.stall.findMany({ where: { merchantId: merchant.id } });
            const stallIds = stalls.map(s => s.id);
            const sales = await tx.pOSSale.count({ where: { stallId: { in: stallIds } } });
            const refunds = await tx.refund.count({ where: { sale: { stallId: { in: stallIds } } } });
            totalTransactions = sales;
            completionScore = sales > 0 ? Math.round(100 - (refunds / sales) * 100) : 50;

            const offers = await tx.sellerOffer.findMany({ where: { stallId: { in: stallIds } } });
            const respondedQuickly = offers.filter(o => {
              if (!o.respondedAt) return false;
              return (o.respondedAt.getTime() - o.createdAt.getTime()) < 2 * 60 * 60 * 1000;
            }).length;
            responseScore = offers.length > 0 ? Math.round((respondedQuickly / offers.length) * 100) : 50;
          }
        }

        const overallScore = Math.round(
          fundingScore * 0.15 +
          completionScore * 0.30 +
          cancellationScore * 0.25 +
          responseScore * 0.15 +
          accuracyScore * 0.15,
        );

        return tx.trustScore.upsert({
          where: { userId },
          update: { overallScore, fundingScore, completionScore, cancellationScore, responseScore, accuracyScore, totalTransactions, totalCancellations, lastCalculatedAt: new Date() },
          create: { userId, overallScore, fundingScore, completionScore, cancellationScore, responseScore, accuracyScore, totalTransactions, totalCancellations },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async recalculateAll() {
    // Only recalculate users whose score hasn't been updated in the last 5 minutes.
    // This prevents double-processing if two concurrent recalculateAll() calls run
    // at the same time (e.g. two admin triggers or overlapping cron runs).
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        OR: [
          { trustScore: null },
          { trustScore: { lastCalculatedAt: { lt: fiveMinutesAgo } } },
        ],
      },
      select: { id: true },
    });
    let processed = 0;
    for (const user of users) {
      try {
        await this.recalculate(user.id);
        processed++;
      } catch (err) { console.error(`Failed to recalculate trust score for user ${user.id}:`, err); }
    }
    return { processed, total: users.length };
  }
}
