import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { containsContactInfo } from '../../common/contact-info.util';

const BUYER_TRIAL_DAYS = 7;

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async browse(params: {
    categoryId?: string;
    mallId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(50, params.limit!)) : 20;
    const where: any = { isActive: true };
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.mallId) where.mallId = params.mallId;
    if (params.q?.trim()) {
      where.OR = [
        { title: { contains: params.q.trim(), mode: 'insensitive' } },
        { description: { contains: params.q.trim(), mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          mall: { select: { id: true, name: true, city: true } },
          stall: { select: { id: true, name: true, stallNumber: true } },
          provider: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.serviceListing.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async findById(id: string, userId?: string) {
    const row = await this.prisma.serviceListing.findFirst({
      where: { id, isActive: true },
      include: {
        category: true,
        mall: true,
        stall: true,
        provider: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!row) throw new NotFoundException('Service not found');

    await this.prisma.serviceListing.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    // Gate provider phone and stall number behind the same wallet/trial check
    // used on the product detail and store pages.
    let showDetails = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
      if (user) {
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
        ...row,
        stall: row.stall ? { ...row.stall, stallNumber: '***' } : null,
        provider: { id: row.provider.id, firstName: row.provider.firstName, lastName: row.provider.lastName, phone: null },
      };
    }

    return row;
  }

  async create(
    userId: string,
    role: UserRole,
    data: {
      stallId: string;
      title: string;
      description?: string;
      categoryId?: string;
      priceFrom?: number;
      imageUrl?: string;
    },
  ) {
    if (role !== UserRole.STALL_OWNER && role !== UserRole.ATTENDANT) {
      throw new ForbiddenException('Only sellers can list services');
    }

    const stall = await this.prisma.stall.findUnique({
      where: { id: data.stallId },
      include: { merchant: true, attendants: { where: { userId, isActive: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');

    const isOwner = stall.merchant.userId === userId;
    const isAttendant = stall.attendants.length > 0;
    if (!isOwner && !isAttendant) throw new ForbiddenException('Not your stall');

    for (const [field, value] of Object.entries({ title: data.title, description: data.description })) {
      if (value && containsContactInfo(value)) {
        throw new BadRequestException(
          `Your service listing ${field} contains information that is not allowed — phone numbers, WhatsApp, ` +
          `emails, social handles, links, or contact phrases are not permitted.`,
        );
      }
    }

    return this.prisma.serviceListing.create({
      data: {
        providerId: userId,
        stallId: stall.id,
        mallId: stall.mallId,
        categoryId: data.categoryId,
        title: data.title.trim(),
        description: data.description?.trim(),
        priceFrom: data.priceFrom,
        imageUrl: data.imageUrl,
      },
      include: {
        category: true,
        mall: true,
        stall: true,
      },
    });
  }
}
