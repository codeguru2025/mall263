import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { POSSaleStatus, WalletTransactionType, WalletTransactionStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getStallReport(stallId: string, startDate: Date, endDate: Date) {
    const sales = await this.prisma.pOSSale.findMany({
      where: { stallId, status: POSSaleStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } },
      include: { items: true },
    });

    const totalRevenue = sales.reduce((s, sale) => s + parseFloat(sale.totalAmount.toString()), 0);
    const totalCost = sales.reduce((s, sale) =>
      s + sale.items.reduce((is2, i) => is2 + parseFloat(i.costPrice.toString()) * i.quantity, 0), 0);
    const totalCommission = sales.reduce((s, sale) => s + parseFloat(sale.commissionAmount.toString()), 0);

    const dailyBreakdown: Record<string, { revenue: number; cost: number; sales: number }> = {};
    for (const sale of sales) {
      const day = sale.createdAt.toISOString().split('T')[0];
      if (!dailyBreakdown[day]) dailyBreakdown[day] = { revenue: 0, cost: 0, sales: 0 };
      dailyBreakdown[day].revenue += parseFloat(sale.totalAmount.toString());
      dailyBreakdown[day].cost += sale.items.reduce((is2, i) => is2 + parseFloat(i.costPrice.toString()) * i.quantity, 0);
      dailyBreakdown[day].sales++;
    }

    const topProducts = await this.prisma.pOSSaleItem.groupBy({
      by: ['productName'],
      where: { sale: { stallId, status: POSSaleStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalSales: sales.length,
        totalRevenue,
        totalCost,
        grossProfit: totalRevenue - totalCost,
        netProfit: totalRevenue - totalCost - totalCommission,
        totalCommission,
        avgOrderValue: sales.length > 0 ? totalRevenue / sales.length : 0,
      },
      dailyBreakdown: Object.entries(dailyBreakdown).map(([date, data]) => ({ date, ...data })),
      topProducts,
    };
  }

  async getPlatformReport(startDate: Date, endDate: Date) {
    const [totalSales, totalMerchants, totalProducts, newUsers] = await Promise.all([
      this.prisma.pOSSale.count({ where: { status: POSSaleStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.merchant.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.product.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    const commissionRevenue = await this.prisma.walletTransaction.aggregate({
      where: { type: WalletTransactionType.COMMISSION_DEDUCTION, status: WalletTransactionStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });

    return {
      period: { start: startDate, end: endDate },
      totalSales, newMerchants: totalMerchants, newProducts: totalProducts, newUsers,
      commissionRevenue: commissionRevenue._sum.amount || 0,
    };
  }
}
