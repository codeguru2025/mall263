import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  StallStatus, ProductStatus, POSSaleStatus,
  DemandStatus, WalletTransactionType, WalletTransactionStatus, UserStatus, UserRole,
} from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [users, merchants, stalls, products, sales, demands] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.merchant.count(),
      this.prisma.stall.count({ where: { status: StallStatus.ACTIVE } }),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.pOSSale.count({ where: { status: POSSaleStatus.COMPLETED } }),
      this.prisma.buyerDemand.count({ where: { status: DemandStatus.OPEN } }),
    ]);

    const revenueResult = await this.prisma.walletTransaction.aggregate({
      where: { type: WalletTransactionType.COMMISSION_DEDUCTION, status: WalletTransactionStatus.COMPLETED },
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

  async listUsers(params: { search?: string; limit?: number }) {
    const { search, limit = 50 } = params;
    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    const data = await this.prisma.user.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, firstName: true, lastName: true, phone: true, role: true, status: true, createdAt: true },
    });
    return { data };
  }

  async changeUserRole(userId: string, role: UserRole) {
    return this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async suspendUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.SUSPENDED } });
  }

  async activateUser(userId: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE } });
  }

  async suspendStall(stallId: string) {
    return this.prisma.stall.update({ where: { id: stallId }, data: { status: StallStatus.SUSPENDED } });
  }

  async suspendProduct(productId: string) {
    return this.prisma.product.update({ where: { id: productId }, data: { status: ProductStatus.SUSPENDED } });
  }
}
