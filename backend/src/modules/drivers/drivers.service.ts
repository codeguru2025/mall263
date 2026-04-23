import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DriverTier, Prisma, UserRole } from '@prisma/client';

const TIER_THRESHOLDS = {
  TRUSTED: { minJobs: 20, minRating: 70 },
  ELITE: { minJobs: 50, minRating: 85 },
};

const COD_LIMITS = {
  ONBOARDING: new Prisma.Decimal(50),
  TRUSTED: new Prisma.Decimal(200),
  ELITE: new Prisma.Decimal(1000),
};

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(userId: string, data: { vehicleType?: string; kycDocUrl?: string }) {
    const existing = await this.prisma.driver.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Driver profile already exists');

    // Update user role to DRIVER
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.DRIVER },
    });

    const driver = await this.prisma.driver.create({
      data: {
        userId,
        vehicleType: data.vehicleType,
        kycDocUrl: data.kycDocUrl,
        tier: DriverTier.ONBOARDING,
        maxCodExposure: COD_LIMITS.ONBOARDING,
      },
    });

    // Role change → subscription plan lookup changes. Invalidate the cache.
    this.subscriptions.invalidateStatusCache(userId).catch(() => {});

    return driver;
  }

  // ─── Get profile ──────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true, role: true } },
        codTransactions: { where: { remittanceStatus: 'PENDING' }, take: 5 },
      },
    });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  // ─── Update location ──────────────────────────────────────────────────────

  async updateLocation(userId: string, lat: number, lng: number) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.driver.update({
      where: { userId },
      data: {
        currentLat: new Prisma.Decimal(lat),
        currentLng: new Prisma.Decimal(lng),
        locationAt: new Date(),
      },
    });
  }

  // ─── Get earnings ─────────────────────────────────────────────────────────

  async getEarnings(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    const [completedJobs, pendingCOD, floatTransactions] = await Promise.all([
      this.prisma.deliveryJob.count({
        where: { driverId: driver.id, status: 'COMPLETED' },
      }),
      this.prisma.cODTransaction.findMany({
        where: { driverId: driver.id, remittanceStatus: 'PENDING' },
      }),
      this.prisma.driverFloatTransaction.findMany({
        where: { driverId: driver.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const totalPendingCash = pendingCOD.reduce(
      (sum, t) => sum + Number(t.cashAmount),
      0,
    );

    return {
      driver: {
        tier: driver.tier,
        totalEarnings: driver.totalEarnings,
        floatBalance: driver.floatBalance,
        codCashHeld: driver.codCashHeld,
        rating: driver.rating,
        completedJobs: driver.completedJobs,
      },
      pendingCOD: { count: pendingCOD.length, totalAmount: totalPendingCash },
      floatTransactions,
    };
  }

  // ─── Admin: approve KYC ───────────────────────────────────────────────────

  async approveKyc(driverId: string) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { kycVerified: true },
    });
  }

  // ─── Admin: update tier ───────────────────────────────────────────────────

  async updateTier(driverId: string, tier: DriverTier) {
    return this.prisma.driver.update({
      where: { id: driverId },
      data: { tier, maxCodExposure: COD_LIMITS[tier] },
    });
  }

  // ─── Auto tier promotion (called after each job completion) ──────────────

  async tryPromoteTier(driverId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return;

    let newTier: DriverTier | null = null;
    const jobs = driver.completedJobs;
    const rating = Number(driver.rating);

    if (
      driver.tier === DriverTier.ONBOARDING &&
      jobs >= TIER_THRESHOLDS.TRUSTED.minJobs &&
      rating >= TIER_THRESHOLDS.TRUSTED.minRating
    ) {
      newTier = DriverTier.TRUSTED;
    } else if (
      driver.tier === DriverTier.TRUSTED &&
      jobs >= TIER_THRESHOLDS.ELITE.minJobs &&
      rating >= TIER_THRESHOLDS.ELITE.minRating
    ) {
      newTier = DriverTier.ELITE;
    }

    if (newTier) {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: { tier: newTier, maxCodExposure: COD_LIMITS[newTier] },
      });
    }
  }

  // ─── Float top-up ─────────────────────────────────────────────────────────

  async topUpFloat(userId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: driver.id },
        data: { floatBalance: { increment: amount } },
      });
      await tx.driverFloatTransaction.create({
        data: {
          driverId: driver.id,
          amount: new Prisma.Decimal(amount),
          type: 'TOP_UP',
          description: 'Manual float top-up',
        },
      });
      return tx.driver.findUnique({ where: { id: driver.id } });
    });
  }

  // ─── Admin: list all drivers ──────────────────────────────────────────────

  async listAll(params: { tier?: DriverTier; active?: boolean; page?: number }) {
    const page = params.page ?? 1;
    const limit = 20;
    const where: Prisma.DriverWhereInput = {};
    if (params.tier) where.tier = params.tier;
    if (params.active !== undefined) where.isActive = params.active;

    const [data, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { firstName: true, lastName: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driver.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }
}
