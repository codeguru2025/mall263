import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  StallStatus, ProductStatus, POSSaleStatus,
  DemandStatus, WalletTransactionType, WalletTransactionStatus, UserStatus, UserRole,
  PromoType, AdPlacement, SubscriptionStatus,
} from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

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

  // ── Users ─────────────────────────────────────────────────────────────────

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

  // ── Stalls ────────────────────────────────────────────────────────────────

  async listStalls(params: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = params;
    const where: any = {};
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { stallNumber: { contains: search.trim(), mode: 'insensitive' } },
        { merchant: { businessName: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.stall.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          merchant: { select: { businessName: true, status: true, user: { select: { phone: true } } } },
          mall: { select: { name: true, city: true } },
          _count: { select: { products: true } },
        },
      }),
      this.prisma.stall.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async suspendStall(stallId: string) {
    return this.prisma.stall.update({ where: { id: stallId }, data: { status: StallStatus.SUSPENDED } });
  }

  async activateStall(stallId: string) {
    return this.prisma.stall.update({ where: { id: stallId }, data: { status: StallStatus.ACTIVE } });
  }

  async suspendProduct(productId: string) {
    return this.prisma.product.update({ where: { id: productId }, data: { status: ProductStatus.SUSPENDED } });
  }

  // ── Categories ────────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
    });
  }

  async createCategory(data: { name: string; parentId?: string; imageUrl?: string }) {
    const slug = this.generateSlug(data.name);
    return this.prisma.category.create({
      data: {
        name: data.name,
        slug,
        parentId: data.parentId || null,
        imageUrl: data.imageUrl || null,
      },
    });
  }

  async updateCategory(id: string, data: { name?: string; parentId?: string; imageUrl?: string; sortOrder?: number; isActive?: boolean }) {
    const updateData: any = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
      updateData.slug = this.generateSlug(data.name);
    }
    if (data.parentId !== undefined) updateData.parentId = data.parentId || null;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.category.update({ where: { id }, data: updateData });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  // ── App Settings ──────────────────────────────────────────────────────────

  async getSettings() {
    const settings = await this.prisma.appSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return { delivery_rate_per_km: '0.50', ...map };
  }

  async setSetting(key: string, value: string) {
    return this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // ── Subscription Management ───────────────────────────────────────────────

  async listSubscriptions(params: { status?: SubscriptionStatus; page?: number; limit?: number; search?: string }) {
    const { status, search } = params;
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, params.limit ?? 30);

    const where: any = {};
    if (status) where.status = status;
    if (search?.trim()) {
      where.user = {
        OR: [
          { firstName: { contains: search.trim(), mode: 'insensitive' } },
          { lastName: { contains: search.trim(), mode: 'insensitive' } },
          { phone: { contains: search.trim() } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true, role: true } },
          payments: { orderBy: { initiatedAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    // Summary counts
    const [trialCount, activeCount, graceCount, expiredCount] = await Promise.all([
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.TRIAL } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.GRACE } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.EXPIRED } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: { trial: trialCount, active: activeCount, grace: graceCount, expired: expiredCount },
    };
  }

  async extendTrial(userId: string, days: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    // Can only extend a TRIAL — or an EXPIRED sub where trial hasn't been re-granted
    const baseDate = sub.status === SubscriptionStatus.TRIAL && sub.trialEndsAt > new Date()
      ? sub.trialEndsAt
      : new Date();

    const newTrialEndsAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: newTrialEndsAt,
        // Clear any pending retry so we don't auto-charge during extended trial
        nextRetryAt: null,
        failedAttempts: 0,
      },
    });
  }

  async grantFreeMonth(userId: string) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        failedAttempts: 0,
        nextRetryAt: null,
      },
    });
  }

  // ── Subscription Plans ────────────────────────────────────────────────────

  async listSubscriptionPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createSubscriptionPlan(data: {
    name: string;
    slug: string;
    priceUsd: number;
    trialDays?: number;
    description?: string;
    features?: string[];
    isActive?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.subscriptionPlan.create({ data: { ...data, features: data.features ?? [] } });
  }

  async updateSubscriptionPlan(id: string, data: {
    name?: string;
    slug?: string;
    priceUsd?: number;
    trialDays?: number;
    description?: string;
    features?: string[];
    isActive?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
  }) {
    // If setting this as default, clear any existing default first
    if (data.isDefault) {
      await this.prisma.subscriptionPlan.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    return this.prisma.subscriptionPlan.update({ where: { id }, data });
  }

  async deleteSubscriptionPlan(id: string) {
    return this.prisma.subscriptionPlan.delete({ where: { id } });
  }

  // ── Promotions ────────────────────────────────────────────────────────────

  async listPromotions() {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createPromotion(
    createdById: string,
    data: {
      code: string;
      type: PromoType;
      discountPct?: number;
      discountAmt?: number;
      maxUses?: number;
      validFrom: string;
      validUntil?: string;
      description?: string;
    },
  ) {
    return this.prisma.promotion.create({
      data: {
        code: data.code.trim().toUpperCase(),
        type: data.type,
        discountPct: data.discountPct ?? null,
        discountAmt: data.discountAmt ?? null,
        maxUses: data.maxUses ?? null,
        validFrom: new Date(data.validFrom),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        description: data.description ?? null,
        createdById,
      },
    });
  }

  async updatePromotion(id: string, data: {
    isActive?: boolean;
    maxUses?: number;
    validUntil?: string;
    description?: string;
    discountPct?: number;
    discountAmt?: number;
  }) {
    const updateData: any = { ...data };
    if (data.validUntil !== undefined) {
      updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    }
    return this.prisma.promotion.update({ where: { id }, data: updateData });
  }

  async deletePromotion(id: string) {
    return this.prisma.promotion.delete({ where: { id } });
  }

  // ── Ads ───────────────────────────────────────────────────────────────────

  async listAds() {
    return this.prisma.ad.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async listActiveAds(role?: string) {
    const now = new Date();
    const roleFilter = role
      ? [{ targetRole: null }, { targetRole: role }]
      : [{ targetRole: null }];

    return this.prisma.ad.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          { OR: roleFilter },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAd(
    createdById: string,
    data: {
      title: string;
      imageUrl?: string;
      linkUrl?: string;
      placement: AdPlacement;
      targetRole?: string;
      startsAt: string;
      endsAt?: string;
    },
  ) {
    return this.prisma.ad.create({
      data: {
        title: data.title,
        imageUrl: data.imageUrl ?? null,
        linkUrl: data.linkUrl ?? null,
        placement: data.placement,
        targetRole: data.targetRole ?? null,
        startsAt: new Date(data.startsAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdById,
      },
    });
  }

  async updateAd(id: string, data: {
    title?: string;
    imageUrl?: string;
    linkUrl?: string;
    placement?: AdPlacement;
    targetRole?: string;
    isActive?: boolean;
    startsAt?: string;
    endsAt?: string;
  }) {
    const updateData: any = { ...data };
    if (data.startsAt) updateData.startsAt = new Date(data.startsAt);
    if (data.endsAt !== undefined) updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;
    return this.prisma.ad.update({ where: { id }, data: updateData });
  }

  async recordAdImpression(id: string) {
    return this.prisma.ad.update({ where: { id }, data: { impressions: { increment: 1 } } });
  }

  async deleteAd(id: string) {
    return this.prisma.ad.delete({ where: { id } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  }
}
