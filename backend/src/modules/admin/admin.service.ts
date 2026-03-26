import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [users, merchants, stalls, products, sales, demands] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.merchant.count(),
      this.prisma.stall.count({ where: { status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.pOSSale.count({ where: { status: 'COMPLETED' } }),
      this.prisma.buyerDemand.count({ where: { status: 'OPEN' } }),
    ]);

    const revenueResult = await this.prisma.walletTransaction.aggregate({
      where: { type: 'COMMISSION_DEDUCTION', status: 'COMPLETED' },
      _sum: { amount: true },
    });

    return {
      users, merchants, stalls, products, sales, openDemands: demands,
      totalCommissionRevenue: revenueResult._sum.amount || 0,
    };
  }

  async getRecentActivity(limit = 20) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    });
  }

  async suspendUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
  }

  async activateUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
  }

  async suspendStall(stallId: string) {
    return this.prisma.stall.update({ where: { id: stallId }, data: { status: 'SUSPENDED' } });
  }

  async suspendProduct(productId: string) {
    return this.prisma.product.update({ where: { id: productId }, data: { status: 'SUSPENDED' } });
  }
}
