import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StallStatus } from '@prisma/client';

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
    phone?: string;
    openTime?: string;
    closeTime?: string;
    operatingDays?: string[];
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.stall.create({
      data: {
        merchantId: data.merchantId,
        mallId: data.mallId,
        stallNumber: data.stallNumber,
        name: data.name,
        floor: data.floor,
        section: data.section,
        description: data.description,
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

  async findById(id: string) {
    const stall = await this.prisma.stall.findUnique({
      where: { id },
      include: {
        mall: true,
        merchant: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        _count: { select: { products: true, posSales: true } },
      },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    return stall;
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
    name: string; description: string; phone: string;
    openTime: string; closeTime: string; operatingDays: string[];
  }>) {
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');
    if (stall.merchant.userId !== userId) throw new ForbiddenException('Not your stall');

    return this.prisma.stall.update({ where: { id: stallId }, data });
  }

  async addAttendant(stallId: string, userId: string, pin?: string) {
    return this.prisma.stallAttendant.create({
      data: { stallId, userId, pin },
    });
  }

  async listMalls(city?: string) {
    const where: any = { isActive: true };
    if (city) where.city = city;
    return this.prisma.mall.findMany({ where, orderBy: { name: 'asc' } });
  }
}
