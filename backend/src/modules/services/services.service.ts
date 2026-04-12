import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

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

  async findById(id: string) {
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
