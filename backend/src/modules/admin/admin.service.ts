import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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

  async listUsers(params: { search?: string; page?: number; limit?: number }) {
    const { search } = params;
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 50));
    const where: any = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, phone: true, role: true, status: true, createdAt: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateUser(
    actorId: string,
    actorRole: UserRole,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string | null;
      phoneVerified?: boolean;
      password?: string;
    },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can edit super admin accounts');
    }

    if (data.phone !== undefined && data.phone.trim()) {
      const normalized = data.phone.trim();
      const taken = await this.prisma.user.findFirst({
        where: { phone: normalized, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) throw new ConflictException('Phone number already in use');
    }

    const updateData: Record<string, unknown> = {};
    if (data.firstName !== undefined) {
      const t = data.firstName.trim();
      if (!t) throw new BadRequestException('First name cannot be empty');
      updateData.firstName = t;
    }
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
    if (data.phone !== undefined && data.phone.trim()) updateData.phone = data.phone.trim();
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.phoneVerified !== undefined) updateData.phoneVerified = data.phoneVerified;
    if (data.password !== undefined && data.password.length > 0) {
      if (data.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData as any,
      select: { id: true, firstName: true, lastName: true, phone: true, role: true, status: true, avatarUrl: true, phoneVerified: true, updatedAt: true },
    });
  }

  async softDeleteUser(actorId: string, actorRole: UserRole, userId: string) {
    if (userId === actorId) throw new BadRequestException('Cannot delete your own account');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can delete super admin accounts');
    }
    if (user.role === UserRole.SUPER_ADMIN) {
      const others = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, id: { not: userId } },
      });
      if (others === 0) throw new BadRequestException('Cannot delete the last active super admin');
    }

    const archivalPhone = `deleted:${user.id}:${Date.now()}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.DEACTIVATED, phone: archivalPhone },
      });
    });

    return { id: userId, status: UserStatus.DEACTIVATED };
  }

  async changeUserRole(actorId: string, actorRole: UserRole, userId: string, role: UserRole) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can change roles of super admin accounts');
    }
    if (role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admins can assign the super admin role');
    }
    if (userId === actorId && role !== target.role && target.role === UserRole.SUPER_ADMIN) {
      const others = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, id: { not: userId } },
      });
      if (others === 0) throw new BadRequestException('Cannot demote the last active super admin');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, firstName: true, lastName: true, phone: true, role: true, status: true },
    });
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
