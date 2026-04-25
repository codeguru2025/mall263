import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { StallAnalyticsEventType, StallStatus, UserRole, WalletTransactionType, WalletTransactionStatus, Prisma } from '@prisma/client';

// Default stall boost pricing in USD — DB-overridable via AppSetting keys: stall_boost_price_7, stall_boost_price_14, stall_boost_price_30
const DEFAULT_STALL_BOOST_PRICES: Record<number, number> = { 7: 1.00, 14: 2.00, 30: 4.00 };

const ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_OPS,
  UserRole.FINANCE_ADMIN,
  UserRole.SUPPORT_ADMIN,
  UserRole.MALL_MANAGER,
];
import { containsContactInfo } from '../../common/contact-info.util';

const BUYER_TRIAL_DAYS = 7;

function assertNoContactInfoInStall(fields: Record<string, string | undefined>) {
  for (const [field, value] of Object.entries(fields)) {
    if (value && containsContactInfo(value)) {
      throw new BadRequestException(
        `Your stall ${field} contains information that is not allowed — phone numbers, WhatsApp, ` +
        `emails, social handles, links, or contact phrases are not permitted.`,
      );
    }
  }
}

@Injectable()
export class StallsService {
  constructor(
    private prisma: PrismaService,
    private search: SearchService,
  ) {}

  private async getStallBoostPrice(days: number): Promise<number> {
    const key = `stall_boost_price_${days}`;
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    if (row) {
      const n = parseFloat(row.value);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return DEFAULT_STALL_BOOST_PRICES[days] ?? 1.00;
  }

  async create(data: {
    merchantId: string;
    mallId?: string;
    stallNumber: string;
    name: string;
    floor?: string;
    section?: string;
    description?: string;
    address?: string;
    phone?: string;
    openTime?: string;
    closeTime?: string;
    operatingDays?: string[];
    latitude?: number;
    longitude?: number;
  }, requesterId: string) {
    assertNoContactInfoInStall({ name: data.name, description: data.description });

    // Verify the caller is the merchant they claim to be, unless they are an admin/agent
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: data.merchantId },
      select: { userId: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const requester = await this.prisma.user.findUnique({ where: { id: requesterId }, select: { role: true } });
    const privilegedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS, UserRole.FIELD_AGENT];
    const isPrivileged = requester && privilegedRoles.includes(requester.role);

    if (!isPrivileged && merchant.userId !== requesterId) {
      throw new ForbiddenException('You can only create stalls for your own merchant account');
    }

    return this.prisma.stall.create({
      data: {
        merchantId: data.merchantId,
        mallId: data.mallId,
        stallNumber: data.stallNumber,
        name: data.name,
        floor: data.floor,
        section: data.section,
        description: data.description,
        address: data.address,
        phone: data.phone,
        openTime: data.openTime,
        closeTime: data.closeTime,
        operatingDays: data.operatingDays || [],
        latitude: data.latitude,
        longitude: data.longitude,
        status: StallStatus.ACTIVE,
      },
      include: { mall: { include: { city: true } } },
    });
  }

  async findById(id: string, userId?: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id },
      include: {
        mall: { include: { city: true } },
        merchant: {
          select: {
            id: true,
            businessName: true,
            logoUrl: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
        _count: { select: { products: true, posSales: true, followers: true } },
      },
    });
    if (!stall) throw new NotFoundException('Stall not found');

    // Apply the same wallet/trial gate as the product detail endpoint.
    // Unauthenticated visitors and buyers who haven't funded their wallet
    // (after the 7-day trial) see a masked profile — no stall number, no
    // mall name, no merchant phone — so the store page cannot be used to
    // bypass the gate on the product detail page.
    //
    // Always unmasked:
    //   - Admin/ops roles (they need full visibility for moderation)
    //   - The merchant who owns this stall
    //   - Active attendants assigned to this stall
    //   - Buyers in their 7-day trial, or with any wallet balance
    let showDetails = false;
    if (userId) {
      const [user, isOwner, isAttendant] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, createdAt: true } }),
        this.prisma.merchant.findFirst({ where: { userId, stalls: { some: { id } } }, select: { id: true } }),
        this.prisma.stallAttendant.findFirst({ where: { stallId: id, userId, isActive: true }, select: { id: true } }),
      ]);

      if (!user) {
        // userId came from a valid JWT but the user record is gone — treat as anonymous
      } else if (ADMIN_ROLES.includes(user.role as UserRole)) {
        showDetails = true;
      } else if (isOwner || isAttendant) {
        showDetails = true;
      } else {
        const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
        if (ageDays < BUYER_TRIAL_DAYS) {
          showDetails = true;
        } else {
          const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
          if (wallet && parseFloat(wallet.availableBalance.toString()) > 0) showDetails = true;
        }
      }
    }

    const isFollowing = userId
      ? !!(await this.prisma.stallFollow.findUnique({
          where: { userId_stallId: { userId, stallId: id } },
          select: { id: true },
        }))
      : false;

    const base = { ...stall, followerCount: stall._count.followers, isFollowing };

    if (!showDetails) {
      return {
        ...base,
        stallNumber: '***',
        address: null,
        description: stall.description ? '🔒 Fund wallet to see full details' : null,
        phone: null,
        mall: stall.mall ? { id: stall.mall.id, name: '🔒 Fund wallet to see seller', city: stall.mall.city?.name ?? null } : null,
        merchant: {
          id: stall.merchant.id,
          businessName: '***',
          logoUrl: stall.merchant.logoUrl,
          user: { firstName: '***', lastName: '***', phone: null },
        },
      };
    }

    return base;
  }

  async recordVisit(stallId: string) {
    const exists = await this.prisma.stall.findUnique({ where: { id: stallId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Stall not found');
    const updated = await this.prisma.stall.update({
      where: { id: stallId },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    void this.prisma.stallAnalyticsEvent
      .create({
        data: { stallId, type: StallAnalyticsEventType.STORE_PAGE_VIEW },
      })
      .catch(() => {});
    return { ok: true as const, viewCount: updated.viewCount };
  }

  async followStall(stallId: string, userId: string) {
    const stall = await this.prisma.stall.findUnique({ where: { id: stallId }, select: { id: true } });
    if (!stall) throw new NotFoundException('Stall not found');
    return this.prisma.$transaction(async (tx) => {
      await tx.stallFollow.upsert({
        where: { userId_stallId: { userId, stallId } },
        create: { userId, stallId },
        update: {},
      });
      const followerCount = await tx.stallFollow.count({ where: { stallId } });
      return { following: true, followerCount };
    });
  }

  async unfollowStall(stallId: string, userId: string) {
    const stall = await this.prisma.stall.findUnique({ where: { id: stallId }, select: { id: true } });
    if (!stall) throw new NotFoundException('Stall not found');
    return this.prisma.$transaction(async (tx) => {
      await tx.stallFollow.deleteMany({ where: { stallId, userId } });
      const followerCount = await tx.stallFollow.count({ where: { stallId } });
      return { following: false, followerCount };
    });
  }

  async getFollowStatus(stallId: string, userId: string) {
    const [follow, followerCount] = await this.prisma.$transaction([
      this.prisma.stallFollow.findUnique({
        where: { userId_stallId: { userId, stallId } },
        select: { id: true },
      }),
      this.prisma.stallFollow.count({ where: { stallId } }),
    ]);
    return { following: !!follow, followerCount };
  }

  async findByMerchant(merchantId: string) {
    return this.prisma.stall.findMany({
      where: { merchantId },
      include: {
        mall: { select: { name: true, city: { select: { name: true } } } },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(stallId: string, userId: string, data: Partial<{
    name: string; description: string; address: string; phone: string;
    openTime: string; closeTime: string; operatingDays: string[];
    imageUrl: string; logoUrl: string | null;
  }>) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    if (stall.merchant.userId !== userId) throw new ForbiddenException('Not your stall');

    assertNoContactInfoInStall({ name: data.name, description: data.description });
    return this.prisma.stall.update({ where: { id: stallId }, data });
  }

  async getPaymentConfig(stallId: string, userId: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    const isOwner = stall.merchant.userId === userId;
    if (!isOwner) {
      const isAttendant = await this.prisma.stallAttendant.findFirst({
        where: { stallId, userId, isActive: true },
      });
      if (!isAttendant) throw new ForbiddenException('Access denied');
    }
    return {
      ecocashMerchantCode: stall.ecocashMerchantCode ?? null,
      onemoneyMerchantCode: stall.onemoneyMerchantCode ?? null,
    };
  }

  async savePaymentConfig(
    stallId: string,
    userId: string,
    data: { ecocashMerchantCode?: string | null; onemoneyMerchantCode?: string | null },
  ) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    if (stall.merchant.userId !== userId) throw new ForbiddenException('Not your stall');
    return this.prisma.stall.update({
      where: { id: stallId },
      data: {
        ecocashMerchantCode: data.ecocashMerchantCode ?? null,
        onemoneyMerchantCode: data.onemoneyMerchantCode ?? null,
      },
      select: { id: true, ecocashMerchantCode: true, onemoneyMerchantCode: true },
    });
  }

  async addAttendant(stallId: string, userId: string, pin?: string) {
    return this.prisma.stallAttendant.create({
      data: { stallId, userId, pin },
    });
  }

  async removeAttendant(stallId: string, targetUserId: string, requestingUserId: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    if (stall.merchant.userId !== requestingUserId) throw new ForbiddenException('Not your stall');

    await this.prisma.stallAttendant.deleteMany({ where: { stallId, userId: targetUserId } });
  }

  async listAttendants(stallId: string, requestingUserId: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    if (stall.merchant.userId !== requestingUserId) throw new ForbiddenException('Not your stall');

    return this.prisma.stallAttendant.findMany({
      where: { stallId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listMalls(city?: string) {
    const where: any = { isActive: true };
    if (city) where.city = { name: { equals: city, mode: 'insensitive' } };
    return this.prisma.mall.findMany({
      where,
      include: { city: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // ── Admin mall management ──────────────────────────────────────────────────

  async listAllMalls() {
    return this.prisma.mall.findMany({
      orderBy: { name: 'asc' },
      include: { city: { select: { name: true } }, _count: { select: { stalls: true } } },
    });
  }

  /** Legacy admin endpoint: accepts city as a name string for backward compat. */
  async createMall(data: {
    name: string;
    city: string;
    address: string;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
  }) {
    const cityName = data.city.trim();
    // Upsert city by name so the API stays backward compatible
    const cityRecord = await this.prisma.city.upsert({
      where: { name: cityName },
      create: { name: cityName },
      update: {},
    });

    return this.prisma.mall.create({
      data: {
        name: data.name.trim(),
        cityId: cityRecord.id,
        address: data.address.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        imageUrl: data.imageUrl,
        isActive: true,
      },
      include: { city: { select: { name: true } }, _count: { select: { stalls: true } } },
    });
  }

  async updateMall(
    mallId: string,
    data: Partial<{
      name: string;
      city: string;
      address: string;
      latitude: number;
      longitude: number;
      imageUrl?: string | null;
      isActive: boolean;
    }>,
  ) {
    const mall = await this.prisma.mall.findUnique({ where: { id: mallId } });
    if (!mall) throw new NotFoundException('Mall not found');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.city !== undefined) {
      // Upsert city by name so the API stays backward compatible
      const cityRecord = await this.prisma.city.upsert({
        where: { name: data.city.trim() },
        create: { name: data.city.trim() },
        update: {},
      });
      updateData.cityId = cityRecord.id;
    }
    if (data.address !== undefined) updateData.address = data.address.trim();
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.mall.update({
      where: { id: mallId },
      data: updateData,
      include: { city: { select: { name: true } }, _count: { select: { stalls: true } } },
    });
  }

  // ── Marketplace visibility ────────────────────────────────────────────────

  async updateMarketplaceVisibility(stallId: string, userId: string, showOnMarketplace: boolean) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    if (stall.merchant.userId !== userId) throw new ForbiddenException('Not your stall');

    const result = await this.prisma.shopSettings.upsert({
      where: { stallId },
      create: { stallId, showOnMarketplace },
      update: { showOnMarketplace },
      select: { stallId: true, showOnMarketplace: true, updatedAt: true },
    });

    // Reindex all of this stall's products so Meilisearch reflects the new
    // visibility immediately. Fire-and-forget — indexing failures must not
    // block the user's settings update.
    this.search.reindexStall(stallId).catch(() => {});

    return result;
  }

  async getMarketplaceVisibility(stallId: string, userId: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: {
        merchant: { select: { userId: true } },
        shopSettings: { select: { showOnMarketplace: true } },
      },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    if (stall.merchant.userId !== userId) throw new ForbiddenException('Not your stall');

    return {
      stallId,
      showOnMarketplace: stall.shopSettings?.showOnMarketplace ?? true,
    };
  }

  // ── Stall Boost ───────────────────────────────────────────────────────────

  async getStallBoostPricing() {
    const durations = [7, 14, 30];
    const prices = await Promise.all(durations.map((d) => this.getStallBoostPrice(d)));
    return durations.map((d, i) => ({ days: d, fee: prices[i] }));
  }

  async boostStall(userId: string, stallId: string, days: number) {
    const price = await this.getStallBoostPrice(days);
    if (!price) throw new BadRequestException('Invalid boost duration. Choose 7, 14, or 30 days.');

    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: true },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    if (stall.merchant.userId !== userId) throw new ForbiddenException('Not your stall');

    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new BadRequestException('Wallet not found');
    const feeDec = new Prisma.Decimal(price);
    if (wallet.availableBalance.lessThan(feeDec)) {
      throw new BadRequestException(
        `Insufficient wallet balance. You need $${Number(price).toFixed(2)} to boost for ${days} days. ` +
        `Current balance: $${wallet.availableBalance.toFixed(2)}`,
      );
    }

    const promotedUntil = new Date();
    promotedUntil.setDate(promotedUntil.getDate() + days);

    await this.prisma.$transaction(
      async (tx) => {
        const balanceBefore = wallet.availableBalance;
        const balanceAfter = balanceBefore.minus(feeDec);
        await tx.wallet.update({
          where: { userId },
          data: { availableBalance: balanceAfter, lastActivityAt: new Date() },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.FEE,
            status: WalletTransactionStatus.COMPLETED,
            amount: feeDec,
            balanceBefore,
            balanceAfter,
            completedAt: new Date(),
            description: `Stall featured boost: ${days} days for "${stall.name}"`,
          },
        });
        await tx.stall.update({
          where: { id: stallId },
          data: { isPromoted: true, promotedUntil },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { message: `Stall boosted for ${days} days until ${promotedUntil.toLocaleDateString()}`, promotedUntil };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expirePromotedStalls() {
    await this.prisma.stall.updateMany({
      where: { isPromoted: true, promotedUntil: { lte: new Date() } },
      data: { isPromoted: false, promotedUntil: null },
    });
  }
}
