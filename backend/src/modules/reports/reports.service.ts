import { Injectable, NotFoundException } from '@nestjs/common';
import {
  POSSaleStatus,
  StallAnalyticsEventType,
  UserRole,
  WalletTransactionType,
  WalletTransactionStatus,
} from '@prisma/client';
import { assertUserCanAccessStall } from '../../common/utils/stall-access';
import { PrismaService } from '../../prisma/prisma.service';

type InsightSeverity = 'positive' | 'warning' | 'info';

export interface ReportInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getStallReport(
    stallId: string,
    startDate: Date,
    endDate: Date,
    actor: { userId: string; role: UserRole },
  ) {
    await assertUserCanAccessStall(this.prisma, actor.userId, actor.role, stallId);

    const sales = await this.prisma.pOSSale.findMany({
      where: { stallId, status: POSSaleStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } },
      include: { items: true },
    });

    const totalRevenue = sales.reduce((s, sale) => s + parseFloat(sale.totalAmount.toString()), 0);
    const totalCost = sales.reduce(
      (s, sale) =>
        s + sale.items.reduce((is2, i) => is2 + parseFloat(i.costPrice.toString()) * i.quantity, 0),
      0,
    );
    const totalCommission = sales.reduce((s, sale) => s + parseFloat(sale.commissionAmount.toString()), 0);
    const netProfit = totalRevenue - totalCost - totalCommission;
    const grossProfit = totalRevenue - totalCost;

    const dailyBreakdown: Record<string, { revenue: number; cost: number; sales: number }> = {};
    for (const sale of sales) {
      const day = sale.createdAt.toISOString().split('T')[0];
      if (!dailyBreakdown[day]) dailyBreakdown[day] = { revenue: 0, cost: 0, sales: 0 };
      dailyBreakdown[day].revenue += parseFloat(sale.totalAmount.toString());
      dailyBreakdown[day].cost += sale.items.reduce(
        (is2, i) => is2 + parseFloat(i.costPrice.toString()) * i.quantity,
        0,
      );
      dailyBreakdown[day].sales++;
    }

    const topProducts = await this.prisma.pOSSaleItem.groupBy({
      by: ['productName'],
      where: {
        sale: { stallId, status: POSSaleStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } },
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 10,
    });

    const expenseGroups = await this.prisma.stallExpense.groupBy({
      by: ['category'],
      where: { stallId, occurredAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const totalExpenses = expenseGroups.reduce(
      (s, g) => s + parseFloat((g._sum.amount ?? 0).toString()),
      0,
    );
    const expenseCount = await this.prisma.stallExpense.count({
      where: { stallId, occurredAt: { gte: startDate, lte: endDate } },
    });
    const profitAfterExpenses = netProfit - totalExpenses;

    const [storePageViews, productDetailViews] = await Promise.all([
      this.prisma.stallAnalyticsEvent.count({
        where: {
          stallId,
          type: StallAnalyticsEventType.STORE_PAGE_VIEW,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.stallAnalyticsEvent.count({
        where: {
          stallId,
          type: StallAnalyticsEventType.PRODUCT_DETAIL_VIEW,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const viewedGroups = await this.prisma.stallAnalyticsEvent.groupBy({
      by: ['productId'],
      where: {
        stallId,
        type: StallAnalyticsEventType.PRODUCT_DETAIL_VIEW,
        createdAt: { gte: startDate, lte: endDate },
        productId: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const viewedIds = viewedGroups.map((v) => v.productId!).filter(Boolean);
    const productsById =
      viewedIds.length > 0
        ? Object.fromEntries(
            (
              await this.prisma.product.findMany({
                where: { id: { in: viewedIds } },
                select: { id: true, name: true },
              })
            ).map((p) => [p.id, p.name]),
          )
        : {};

    const topProductsByViews = viewedGroups.map((g) => ({
      productId: g.productId,
      productName: g.productId ? productsById[g.productId] || 'Unknown' : null,
      views: g._count._all,
    }));

    const topSoldNames = new Set(topProducts.map((t) => t.productName));
    const insights = this.buildStallInsights({
      totalRevenue,
      netProfit,
      totalExpenses,
      profitAfterExpenses,
      storePageViews,
      productDetailViews,
      salesCount: sales.length,
      expenseCount,
      topSoldNames,
      topProductsByViews,
    });

    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalSales: sales.length,
        totalRevenue,
        totalCost,
        grossProfit,
        netProfit,
        totalCommission,
        totalExpenses,
        profitAfterExpenses,
        expenseEntryCount: expenseCount,
        avgOrderValue: sales.length > 0 ? totalRevenue / sales.length : 0,
      },
      dailyBreakdown: Object.entries(dailyBreakdown).map(([date, data]) => ({ date, ...data })),
      topProducts,
      expenses: {
        total: totalExpenses,
        count: expenseCount,
        byCategory: expenseGroups.map((g) => ({
          category: g.category,
          total: parseFloat((g._sum.amount ?? 0).toString()),
          count: g._count._all,
        })),
      },
      engagement: {
        storePageViews,
        productDetailViews,
        topProductsByViews,
      },
      insights,
    };
  }

  async getMallReport(mallId: string, startDate: Date, endDate: Date) {
    const mall = await this.prisma.mall.findUnique({ where: { id: mallId } });
    if (!mall) throw new NotFoundException('Mall not found');

    const stalls = await this.prisma.stall.findMany({
      where: { mallId },
      select: { id: true, name: true, stallNumber: true },
    });
    const stallIds = stalls.map((s) => s.id);
    if (stallIds.length === 0) {
      return {
        mall: { id: mall.id, name: mall.name, city: mall.city },
        period: { start: startDate, end: endDate },
        summary: {
          stallCount: 0,
          totalSales: 0,
          totalRevenue: 0,
          totalCommission: 0,
          netProfit: 0,
          totalExpenses: 0,
          profitAfterExpenses: 0,
          storePageViews: 0,
          productDetailViews: 0,
        },
        stalls: [],
        insights: [
          {
            id: 'no-stalls',
            severity: 'info' as const,
            title: 'No stalls linked',
            detail: 'Assign stalls to this mall to see trading and footfall metrics.',
          },
        ],
      };
    }

    const sales = await this.prisma.pOSSale.findMany({
      where: {
        stallId: { in: stallIds },
        status: POSSaleStatus.COMPLETED,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { items: true, stall: { select: { id: true, name: true, stallNumber: true } } },
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalCommission = 0;
    const revenueByStall: Record<string, number> = {};
    for (const sale of sales) {
      const rev = parseFloat(sale.totalAmount.toString());
      const cost = sale.items.reduce(
        (s, i) => s + parseFloat(i.costPrice.toString()) * i.quantity,
        0,
      );
      const comm = parseFloat(sale.commissionAmount.toString());
      totalRevenue += rev;
      totalCost += cost;
      totalCommission += comm;
      revenueByStall[sale.stallId] = (revenueByStall[sale.stallId] || 0) + rev;
    }
    const netProfit = totalRevenue - totalCost - totalCommission;

    const expenseAgg = await this.prisma.stallExpense.aggregate({
      where: { stallId: { in: stallIds }, occurredAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
      _count: true,
    });
    const totalExpenses = parseFloat((expenseAgg._sum.amount ?? 0).toString());
    const profitAfterExpenses = netProfit - totalExpenses;

    const [storePageViews, productDetailViews] = await Promise.all([
      this.prisma.stallAnalyticsEvent.count({
        where: {
          stallId: { in: stallIds },
          type: StallAnalyticsEventType.STORE_PAGE_VIEW,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      this.prisma.stallAnalyticsEvent.count({
        where: {
          stallId: { in: stallIds },
          type: StallAnalyticsEventType.PRODUCT_DETAIL_VIEW,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const stallRows = stalls.map((st) => ({
      stallId: st.id,
      name: st.name,
      stallNumber: st.stallNumber,
      revenue: revenueByStall[st.id] || 0,
    })).sort((a, b) => b.revenue - a.revenue);

    const insights: ReportInsight[] = [];
    if (totalRevenue > 0 && totalExpenses / totalRevenue > 0.35) {
      insights.push({
        id: 'mall-high-opex',
        severity: 'warning',
        title: 'Mall-wide operating costs are elevated',
        detail: `Recorded expenses are ${((totalExpenses / totalRevenue) * 100).toFixed(0)}% of marketplace revenue in this period. Review rent and shared services allocations.`,
      });
    }
    if (storePageViews > 20 && sales.length < Math.max(3, storePageViews * 0.02)) {
      insights.push({
        id: 'mall-traffic-convert',
        severity: 'info',
        title: 'Footfall vs checkout',
        detail: 'Digital footfall is healthy but POS sales are modest — consider mall-wide promotions or wayfinding to stalls.',
      });
    }
    if (stallRows.length > 1 && stallRows[0].revenue > 0 && stallRows[stallRows.length - 1].revenue === 0) {
      insights.push({
        id: 'mall-concentration',
        severity: 'info',
        title: 'Uneven stall performance',
        detail: `${stallRows[0].name} leads sales; some stalls have no recorded revenue — targeted support or layout review may help.`,
      });
    }
    if (insights.length === 0) {
      insights.push({
        id: 'mall-ok',
        severity: 'positive',
        title: 'Period snapshot complete',
        detail: 'Use stall-level reports for salaries, transport, and per-store profitability.',
      });
    }

    return {
      mall: { id: mall.id, name: mall.name, city: mall.city },
      period: { start: startDate, end: endDate },
      summary: {
        stallCount: stalls.length,
        totalSales: sales.length,
        totalRevenue,
        totalCommission,
        netProfit,
        totalExpenses,
        profitAfterExpenses,
        storePageViews,
        productDetailViews,
      },
      stalls: stallRows,
      insights,
    };
  }

  async getPlatformReport(startDate: Date, endDate: Date) {
    const [totalSales, totalMerchants, totalProducts, newUsers] = await Promise.all([
      this.prisma.pOSSale.count({
        where: { status: POSSaleStatus.COMPLETED, createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.merchant.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.product.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    ]);

    const commissionRevenue = await this.prisma.walletTransaction.aggregate({
      where: {
        type: WalletTransactionType.COMMISSION_DEDUCTION,
        status: WalletTransactionStatus.COMPLETED,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    return {
      period: { start: startDate, end: endDate },
      totalSales,
      newMerchants: totalMerchants,
      newProducts: totalProducts,
      newUsers,
      commissionRevenue: commissionRevenue._sum.amount || 0,
    };
  }

  private buildStallInsights(params: {
    totalRevenue: number;
    netProfit: number;
    totalExpenses: number;
    profitAfterExpenses: number;
    storePageViews: number;
    productDetailViews: number;
    salesCount: number;
    expenseCount: number;
    topSoldNames: Set<string>;
    topProductsByViews: Array<{ productName: string | null; views: number }>;
  }): ReportInsight[] {
    const out: ReportInsight[] = [];
    const {
      totalRevenue,
      netProfit: _netProfit,
      totalExpenses,
      profitAfterExpenses,
      storePageViews,
      productDetailViews,
      salesCount,
      expenseCount,
      topSoldNames,
      topProductsByViews,
    } = params;

    if (totalRevenue > 0 && expenseCount === 0) {
      out.push({
        id: 'log-expenses',
        severity: 'info',
        title: 'Add operating expenses',
        detail:
          'Log rent, wages, transport, and meals so “profit after expenses” reflects real take-home.',
      });
    }

    if (profitAfterExpenses < 0 && totalRevenue > 0) {
      out.push({
        id: 'operating-loss',
        severity: 'warning',
        title: 'Operating loss this period',
        detail: 'After cost of goods, commission, and recorded expenses, the stall is underwater. Review pricing, COGS, or overheads.',
      });
    } else if (profitAfterExpenses > 0 && totalRevenue > 0) {
      out.push({
        id: 'in-the-black',
        severity: 'positive',
        title: 'Positive after operating costs',
        detail: `Estimated take-home (after expenses) is strong for this window — ${((profitAfterExpenses / totalRevenue) * 100).toFixed(1)}% of revenue.`,
      });
    }

    if (totalRevenue > 0 && totalExpenses / totalRevenue > 0.3) {
      out.push({
        id: 'high-opex-ratio',
        severity: 'warning',
        title: 'Expenses vs revenue',
        detail: `Recorded expenses are ${((totalExpenses / totalRevenue) * 100).toFixed(0)}% of revenue. Check recurring costs (rent, salaries).`,
      });
    }

    if (storePageViews >= 10 && salesCount < Math.max(2, storePageViews * 0.05)) {
      out.push({
        id: 'traffic-not-sales',
        severity: 'info',
        title: 'Browsers vs buyers',
        detail:
          'Your store page had meaningful views but few POS sales — refresh bestsellers, pricing, or in-stall conversion.',
      });
    }

    const highViewLowSale = topProductsByViews.find(
      (v) => v.productName && v.views >= 5 && !topSoldNames.has(v.productName),
    );
    if (highViewLowSale?.productName) {
      out.push({
        id: 'attention-gap',
        severity: 'info',
        title: 'Interest without basket',
        detail: `"${highViewLowSale.productName}" is often viewed but not in your top sellers — check stock, display, or price.`,
      });
    }

    if (productDetailViews > 0 && salesCount === 0 && totalRevenue === 0) {
      out.push({
        id: 'views-no-sales',
        severity: 'info',
        title: 'Product curiosity',
        detail: 'Shoppers are opening listings but no POS sales recorded — ensure checkout is easy and stock is visible.',
      });
    }

    if (out.length === 0) {
      out.push({
        id: 'baseline',
        severity: 'info',
        title: 'Keep logging activity',
        detail: 'Record expenses and process sales consistently for sharper insights next period.',
      });
    }

    return out;
  }
}
