import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallet: { select: { availableBalance: true, lockedBalance: true, currency: true } },
        trustScore: { select: { overallScore: true } },
        merchant: { select: { id: true, businessName: true, status: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, phone: true, firstName: true, lastName: true, avatarUrl: true, role: true, status: true },
    });
  }

  async updateStatus(userId: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  async listUsers(params: { role?: UserRole; status?: UserStatus; page?: number; limit?: number }) {
    const { role, status, page = 1, limit = 20 } = params;
    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, phone: true, firstName: true, lastName: true,
          role: true, status: true, createdAt: true, lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
