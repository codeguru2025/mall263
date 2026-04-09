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
      imageUrl: string;
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
}
