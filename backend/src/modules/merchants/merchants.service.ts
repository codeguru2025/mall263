import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { MerchantStatus, Prisma, UserRole, StallStatus } from '@prisma/client';
import { containsContactInfo } from '../../common/contact-info.util';

function assertNoContactInfoInStallFields(fields: Record<string, string | undefined>) {
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
export class MerchantsService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {}

  async onboardMerchant(data: {
    userId: string;
    businessName: string;
    businessPhone?: string;
    agentId?: string;
  }) {
    return this.prisma.$retryTransaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new NotFoundException('User not found');

      const existing = await tx.merchant.findUnique({ where: { userId: data.userId } });
      if (existing) throw new BadRequestException('User is already a merchant');

      await tx.user.update({ where: { id: data.userId }, data: { role: UserRole.STALL_OWNER } });

      const merchant = await tx.merchant.create({
        data: {
          userId: data.userId,
          businessName: data.businessName,
          businessPhone: data.businessPhone,
          onboardedById: data.agentId,
          status: MerchantStatus.PENDING,
          subscriptionTier: 'basic',
        },
        include: { user: { select: { id: true, phone: true, firstName: true, lastName: true } } },
      });

      // Promotion to STALL_OWNER changes the subscription plan tier used by
      // getStatus — bust the cache so the next read reflects the seller plan.
      this.subscriptions.invalidateStatusCache(data.userId).catch(() => {});

      return merchant;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async selfSetup(userId: string, data: {
    businessName: string;
    businessPhone?: string;
    stallName: string;
    stallNumber: string;
    mallId?: string;
    description?: string;
    address?: string;
    phone?: string;
  }) {
    const mallId = data.mallId?.trim() ? data.mallId.trim() : null;
    assertNoContactInfoInStallFields({
      name: data.stallName,
      description: data.description,
    });

    return this.prisma.$retryTransaction(async (tx) => {
      const existing = await tx.merchant.findUnique({ where: { userId } });
      if (existing) throw new BadRequestException('Merchant profile already exists');
      const merchant = await tx.merchant.create({
        data: {
          userId,
          businessName: data.businessName,
          businessPhone: data.businessPhone,
          status: MerchantStatus.PENDING,
          subscriptionTier: 'basic',
        },
      });

      const stall = await tx.stall.create({
        data: {
          merchantId: merchant.id,
          mallId,
          stallNumber: data.stallNumber.trim(),
          name: data.stallName.trim(),
          description: data.description?.trim() || null,
          address: data.address?.trim() || null,
          phone: data.phone?.trim() || data.businessPhone?.trim() || null,
          operatingDays: [],
          status: StallStatus.ACTIVE,
        },
      });

      return { merchant, stall };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async verifyMerchant(merchantId: string) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: { status: MerchantStatus.VERIFIED, verifiedAt: new Date() },
    });
  }

  async suspendMerchant(merchantId: string) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: { status: MerchantStatus.SUSPENDED },
    });
  }

  async activateMerchant(merchantId: string) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: { status: MerchantStatus.VERIFIED },
    });
  }

  async getMerchantByUserId(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: {
        stalls: { include: { _count: { select: { products: true } } } },
        user: { select: { id: true, phone: true, firstName: true, lastName: true } },
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  async updateMyBranding(userId: string, data: { logoUrl?: string | null }) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    const update: { logoUrl?: string | null } = {};
    if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl;
    return this.prisma.merchant.update({
      where: { id: merchant.id },
      data: update,
    });
  }

  async listMerchants(params: { status?: MerchantStatus; search?: string; page?: number; limit?: number }) {
    const { status, search, page = 1, limit = 20 } = params;
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.merchant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, phone: true, firstName: true, lastName: true } },
          stalls: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.merchant.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
