import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantStatus, UserRole } from '@prisma/client';

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService) {}

  async onboardMerchant(data: {
    userId: string;
    businessName: string;
    businessPhone?: string;
    businessEmail?: string;
    agentId?: string;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.merchant.findUnique({ where: { userId: data.userId } });
    if (existing) throw new BadRequestException('User is already a merchant');

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: data.userId }, data: { role: UserRole.STALL_OWNER } });

      return tx.merchant.create({
        data: {
          userId: data.userId,
          businessName: data.businessName,
          businessPhone: data.businessPhone,
          businessEmail: data.businessEmail,
          onboardedById: data.agentId,
          status: MerchantStatus.PENDING,
          subscriptionTier: 'basic',
        },
        include: { user: { select: { id: true, phone: true, firstName: true, lastName: true } } },
      });
    });
  }

  async verifyMerchant(merchantId: string) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: { status: MerchantStatus.VERIFIED, verifiedAt: new Date() },
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

  async listMerchants(params: { status?: MerchantStatus; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params;
    const where: any = {};
    if (status) where.status = status;

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
