import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { StallAnalyticsEventType, StallStatus, UserRole, WalletTransactionType, WalletTransactionStatus, Prisma } from '@prisma/client';

// Stall boost pricing in USD
const STALL_BOOST_PRICES: Record<number, number> = { 7: 1.00, 14: 2.00, 30: 4.00 };

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
  constructor(private prisma: PrismaService) {}

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
  }) {
    assertNoContactInfoInStall({ name: data.name, description: data.description });
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
      include: { mall: true },
    });
  }

  async findById(id: string, userId?: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id },
      include: {
        mall: true,
        merchant: {
          select: {
            id: true,
            businessName: true,
            logoUrl: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
        _count: { select: { products: true, posSales: true } },
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

    if (!showDetails) {
      return {
        ...stall,
        stallNumber: '***',
        address: null,
        description: stall.description ? '🔒 Fund wallet to see full details' : null,
        phone: null,
        mall: stall.mall ? { id: stall.mall.id, name: '🔒 Fund wallet to see seller', city: stall.mall.city } : null,
        merchant: {
          id: stall.merchant.id,
          businessName: '***',
          logoUrl: stall.merchant.logoUrl,
          user: { firstName: '***', lastName: '***', phone: null },
        },
      };
    }

    return stall;
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

  async findByMerchant(merchantId: string) {
    return this.prisma.stall.findMany({
      where: { merchantId },
      include: {
        mall: { select: { name: true, city: true } },
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

  async addAttendant(stallId: string, userId: string, pin?: string) {
    return this.prisma.stallAttendant.create({
      data: { stallId, userId, pin },
    });
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
    if (city) where.city = city;
    return this.prisma.mall.findMany({ where, orderBy: { name: 'asc' } });
  }

  // ── Admin mall management ──────────────────────────────────────────────────

  async listAllMalls() {
    return this.prisma.mall.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { stalls: true } } },
    });
  }

  async createMall(data: {
    name: string;
    city: string;
    address: string;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
  }) {
    return this.prisma.mall.create({
      data: {
        name: data.name.trim(),
        city: data.city.trim(),
        address: data.address.trim(),
        latitude: data.latitude,
        longitude: data.longitude,
        imageUrl: data.imageUrl,
        isActive: true,
      },
      include: { _count: { select: { stalls: true } } },
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
    if (data.city !== undefined) updateData.city = data.city.trim();
    if (data.address !== undefined) updateData.address = data.address.trim();
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.mall.update({
      where: { id: mallId },
      data: updateData,
      include: { _count: { select: { stalls: true } } },
    });
  }

  // ── Stall Boost ───────────────────────────────────────────────────────────

  getStallBoostPricing() {
    return Object.entries(STALL_BOOST_PRICES).map(([days, price]) => ({
      days: parseInt(days),
      priceUsd: price,
    }));
  }

  async boostStall(userId: string, stallId: string, days: number) {
    const price = STALL_BOOST_PRICES[days];
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
        `Insufficient wallet balance. You need $${price.toFixed(2)} to boost for ${days} days. ` +
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
