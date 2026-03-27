import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TrustService {
  constructor(private prisma: PrismaService) {}

  async getScore(userId: string) {
    const score = await this.prisma.trustScore.findUnique({ where: { userId } });
    if (!score) throw new NotFoundException('Trust score not found');
    return score;
  }

  async recalculate(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    const deposits = await this.prisma.walletTransaction.count({
      where: { walletId: wallet?.id, type: 'DEPOSIT', status: 'COMPLETED' },
    });

    // Calculate funding score (0-100) based on deposit history
    const fundingScore = Math.min(100, deposits * 10);

    // Calculate completion score based on role
    let completionScore = 50;
    let cancellationScore = 50;
    let responseScore = 50;
    const accuracyScore = 50;
    let totalTransactions = 0;
    let totalCancellations = 0;

    if (user.role === 'BUYER') {
      const demands = await this.prisma.buyerDemand.findMany({ where: { buyerId: userId } });
      const matched = demands.filter(d => d.status === 'MATCHED').length;
      const cancelled = demands.filter(d => d.status === 'CANCELLED').length;
      totalTransactions = demands.length;
      totalCancellations = cancelled;
      completionScore = totalTransactions > 0 ? Math.round((matched / totalTransactions) * 100) : 50;
      cancellationScore = totalTransactions > 0 ? Math.round(100 - (cancelled / totalTransactions) * 100) : 50;
    } else if (user.role === 'STALL_OWNER') {
      const merchant = await this.prisma.merchant.findUnique({ where: { userId } });
      if (merchant) {
        const stalls = await this.prisma.stall.findMany({ where: { merchantId: merchant.id } });
        const stallIds = stalls.map(s => s.id);
        const sales = await this.prisma.pOSSale.count({ where: { stallId: { in: stallIds } } });
        const refunds = await this.prisma.refund.count({
          where: { sale: { stallId: { in: stallIds } } },
        });
        totalTransactions = sales;
        completionScore = sales > 0 ? Math.round(100 - (refunds / sales) * 100) : 50;

        const offers = await this.prisma.sellerOffer.findMany({ where: { stallId: { in: stallIds } } });
        const respondedQuickly = offers.filter(o => {
          if (!o.respondedAt) return false;
          const diff = o.respondedAt.getTime() - o.createdAt.getTime();
          return diff < 2 * 60 * 60 * 1000; // within 2 hours
        }).length;
        responseScore = offers.length > 0 ? Math.round((respondedQuickly / offers.length) * 100) : 50;
      }
    }

    const overallScore = Math.round(
      fundingScore * 0.15 +
      completionScore * 0.30 +
      cancellationScore * 0.25 +
      responseScore * 0.15 +
      accuracyScore * 0.15
    );

    return this.prisma.trustScore.upsert({
      where: { userId },
      update: {
        overallScore,
        fundingScore,
        completionScore,
        cancellationScore,
        responseScore,
        accuracyScore,
        totalTransactions,
        totalCancellations,
        lastCalculatedAt: new Date(),
      },
      create: {
        userId,
        overallScore,
        fundingScore,
        completionScore,
        cancellationScore,
        responseScore,
        accuracyScore,
        totalTransactions,
        totalCancellations,
      },
    });
  }

  async recalculateAll() {
    const users = await this.prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
    let processed = 0;
    for (const user of users) {
      try {
        await this.recalculate(user.id);
        processed++;
      } catch { /* skip errors */ }
    }
    return { processed, total: users.length };
  }
}
