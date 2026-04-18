import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async listMyAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAddress(userId: string, data: {
    label: string;
    line1: string;
    line2?: string;
    city: string;
    country?: string;
    isDefault?: boolean;
  }) {
    if (data.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.userAddress.create({
      data: {
        userId,
        label: data.label.trim(),
        line1: data.line1.trim(),
        line2: data.line2?.trim() || null,
        city: data.city.trim(),
        country: data.country ?? 'ZW',
        isDefault: data.isDefault ?? false,
      },
    });
  }

  async updateAddress(addressId: string, userId: string, data: Partial<{
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    country: string;
    isDefault: boolean;
  }>) {
    const address = await this.prisma.userAddress.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Not your address');

    if (data.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.update({
      where: { id: addressId },
      data: {
        ...(data.label !== undefined ? { label: data.label.trim() } : {}),
        ...(data.line1 !== undefined ? { line1: data.line1.trim() } : {}),
        ...(data.line2 !== undefined ? { line2: data.line2?.trim() || null } : {}),
        ...(data.city !== undefined ? { city: data.city.trim() } : {}),
        ...(data.country !== undefined ? { country: data.country } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
    });
  }

  async deleteAddress(addressId: string, userId: string) {
    const address = await this.prisma.userAddress.findUnique({ where: { id: addressId } });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException('Not your address');
    await this.prisma.userAddress.delete({ where: { id: addressId } });
    return { ok: true };
  }
}
