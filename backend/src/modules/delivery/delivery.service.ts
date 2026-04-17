import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DeliveryMode,
  DeliveryJobStatus,
  EscrowStatus,
  CODRemittanceStatus,
  NotificationType,
  UserRole,
  Prisma,
} from '@prisma/client';

// Default delivery broadcast radius in km
const DELIVERY_RADIUS_KM_DEFAULT = 10;

/** Haversine great-circle distance between two GPS points in km. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Feature flags are read from AppSetting at runtime
const FLAGS = {
  DELIVERY_LAYER: 'ENABLE_DELIVERY_LAYER',
  SAFE_PAY: 'ENABLE_SAFE_PAY_ESCROW',
  COD: 'ENABLE_COD_SYSTEM',
  DIRECT_DEAL: 'ENABLE_DIRECT_DEAL',
  RISK_RESERVES: 'ENABLE_RISK_RESERVES',
  DRIVER_FLOAT: 'ENABLE_DRIVER_FLOAT_SYSTEM',
};

// Financial constants
const PLATFORM_FEE_RATE = 0.03;   // 3% platform fee on item amount
const RESERVE_RATE = 0.02;         // 2% split to risk reserve pool
const FLOAT_AUTO_HOLD_RATE = 0.10; // 10% of driver earnings held as float top-up
const COD_TIER_LIMITS = {
  ONBOARDING: 50,
  TRUSTED: 200,
  ELITE: 1000,
};

@Injectable()
export class DeliveryService {
  constructor(
    private prisma: PrismaService,
    private wallet: WalletService,
    private notifications: NotificationsService,
  ) {}

  // ─── Feature flag helpers ─────────────────────────────────────────────────

  private async getFlag(key: string): Promise<boolean> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key } });
    return setting?.value === 'true';
  }

  private async requireFlag(key: string) {
    const enabled = await this.getFlag(key);
    if (!enabled) throw new BadRequestException(`Feature ${key} is not enabled`);
  }

  // ─── Job creation ─────────────────────────────────────────────────────────

  async createJob(params: {
    orderId: string;
    orderType: 'OFFER' | 'POS_SALE';
    sellerId: string;
    buyerId: string;
    mode: DeliveryMode;
    pickupZone: string;
    dropZone: string;
    pickupAddress: string;
    dropAddress: string;
    pickupLat?: number;
    pickupLng?: number;
    dropLat?: number;
    dropLng?: number;
    distanceKm?: number;
    itemAmount: number;
    deliveryFee: number;
  }) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    if (params.mode === DeliveryMode.DIRECT_DEAL) {
      await this.requireFlag(FLAGS.DIRECT_DEAL);
    }
    if (params.mode === DeliveryMode.SAFE_PAY) {
      await this.requireFlag(FLAGS.SAFE_PAY);
    }
    if (params.mode === DeliveryMode.CASH_ON_DELIVERY) {
      await this.requireFlag(FLAGS.COD);
    }

    const platformFee = Number((params.itemAmount * PLATFORM_FEE_RATE).toFixed(2));
    const reserveAmount = Number((params.itemAmount * RESERVE_RATE).toFixed(2));
    const driverEarning = Number((params.deliveryFee * 0.85).toFixed(2)); // driver gets 85% of delivery fee

    const job = await this.prisma.$transaction(
      async (tx) => {
      const deliveryJob = await tx.deliveryJob.create({
        data: {
          orderId: params.orderId,
          orderType: params.orderType,
          sellerId: params.sellerId,
          buyerId: params.buyerId,
          mode: params.mode,
          status: params.mode === DeliveryMode.DIRECT_DEAL
            ? DeliveryJobStatus.COMPLETED  // Direct deal needs no driver
            : DeliveryJobStatus.BROADCAST,
          pickupZone: params.pickupZone,
          dropZone: params.dropZone,
          pickupAddress: params.pickupAddress,
          dropAddress: params.dropAddress,
          pickupLat: params.pickupLat ? new Prisma.Decimal(params.pickupLat) : null,
          pickupLng: params.pickupLng ? new Prisma.Decimal(params.pickupLng) : null,
          dropLat: params.dropLat ? new Prisma.Decimal(params.dropLat) : null,
          dropLng: params.dropLng ? new Prisma.Decimal(params.dropLng) : null,
          distanceKm: params.distanceKm ? new Prisma.Decimal(params.distanceKm) : null,
          itemAmount: new Prisma.Decimal(params.itemAmount),
          deliveryFee: new Prisma.Decimal(params.deliveryFee),
          platformFee: new Prisma.Decimal(platformFee),
          reserveAmount: new Prisma.Decimal(reserveAmount),
          driverEarning: new Prisma.Decimal(driverEarning),
          broadcastedAt: params.mode !== DeliveryMode.DIRECT_DEAL ? new Date() : null,
        },
      });

      // Lock buyer funds in escrow for SafePay
      if (params.mode === DeliveryMode.SAFE_PAY) {
        const totalHeld = params.itemAmount + params.deliveryFee + platformFee;
        await tx.escrowAccount.create({
          data: {
            jobId: deliveryJob.id,
            buyerId: params.buyerId,
            totalHeld: new Prisma.Decimal(totalHeld),
            itemAmount: new Prisma.Decimal(params.itemAmount),
            deliveryFee: new Prisma.Decimal(params.deliveryFee),
            platformFee: new Prisma.Decimal(platformFee),
            reserveAmt: new Prisma.Decimal(reserveAmount),
            status: EscrowStatus.HELD,
          },
        });

        // Debit buyer wallet
        await this.wallet.debitForEscrow(params.buyerId, totalHeld, deliveryJob.id, tx);
      }

      return deliveryJob;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Notify nearby drivers (broadcast)
    if (job.status === DeliveryJobStatus.BROADCAST) {
      await this.broadcastToDrivers(job.id, params.pickupZone, params.pickupLat, params.pickupLng);
    }

    return job;
  }

  // ─── Broadcast ────────────────────────────────────────────────────────────

  private async getRadiusKm(): Promise<number> {
    const s = await this.prisma.appSetting.findUnique({ where: { key: 'DELIVERY_RADIUS_KM' } });
    const v = s ? Number(s.value) : NaN;
    return isNaN(v) || v <= 0 ? DELIVERY_RADIUS_KM_DEFAULT : v;
  }

  private async broadcastToDrivers(
    jobId: string,
    zone: string,
    pickupLat?: number,
    pickupLng?: number,
  ) {
    const radiusKm = await this.getRadiusKm();

    const allDrivers = await this.prisma.driver.findMany({
      where: { isActive: true, kycVerified: true },
      include: { user: true },
    });

    // Filter by GPS radius when the job has pickup coordinates AND the driver has a recent location
    let targets = allDrivers;
    if (pickupLat != null && pickupLng != null) {
      const nearby = allDrivers.filter((d) => {
        if (d.currentLat == null || d.currentLng == null) return false;
        // Ignore stale locations older than 30 minutes
        if (d.locationAt && Date.now() - d.locationAt.getTime() > 30 * 60 * 1000) return false;
        return haversineKm(Number(d.currentLat), Number(d.currentLng), pickupLat, pickupLng) <= radiusKm;
      });
      // Fall back to all active drivers if nobody is nearby (e.g. all offline)
      targets = nearby.length > 0 ? nearby : allDrivers;
    }

    await Promise.all(
      targets.map((d) =>
        this.notifications.send(
          d.userId,
          NotificationType.JOB_BROADCAST,
          'New delivery job',
          `Pickup: ${zone}. Open in app to view details.`,
          { jobId },
        ),
      ),
    );
  }

  // ─── Get broadcast jobs (driver view — zones only, radius-filtered) ─────────

  async getBroadcastJobs(driverId: string) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver?.isActive || !driver.kycVerified) {
      throw new ForbiddenException('Driver not active or KYC not verified');
    }

    const radiusKm = await this.getRadiusKm();

    const jobs = await this.prisma.deliveryJob.findMany({
      where: { status: DeliveryJobStatus.BROADCAST },
      select: {
        id: true,
        mode: true,
        pickupZone: true,
        dropZone: true,
        distanceKm: true,
        driverEarning: true,
        broadcastedAt: true,
        pickupLat: true,
        pickupLng: true,
        // No addresses, no contact details revealed until accepted
      },
      orderBy: { broadcastedAt: 'desc' },
    });

    const hasDriverGps = driver.currentLat != null && driver.currentLng != null;
    const driverLat = hasDriverGps ? Number(driver.currentLat) : null;
    const driverLng = hasDriverGps ? Number(driver.currentLng) : null;

    return jobs
      .filter((j) => {
        // If driver has no GPS, show all jobs
        if (!hasDriverGps) return true;
        // If job has no GPS, show it (zone-only jobs always visible)
        if (j.pickupLat == null || j.pickupLng == null) return true;
        return haversineKm(driverLat!, driverLng!, Number(j.pickupLat), Number(j.pickupLng)) <= radiusKm;
      })
      .map((j) => {
        const distFromDriver =
          hasDriverGps && j.pickupLat != null && j.pickupLng != null
            ? Number(haversineKm(driverLat!, driverLng!, Number(j.pickupLat), Number(j.pickupLng)).toFixed(2))
            : null;
        // Strip GPS coords — drivers don't need them before accepting
        const { pickupLat, pickupLng, ...safe } = j;
        return { ...safe, distFromDriverKm: distFromDriver, radiusKm };
      });
  }

  // ─── Accept job ───────────────────────────────────────────────────────────

  async acceptJob(jobId: string, driverId: string) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$transaction(async (tx) => {
      // Re-fetch driver inside tx so COD exposure check reflects latest state
      const driver = await tx.driver.findUnique({ where: { id: driverId } });
      if (!driver?.isActive || !driver.kycVerified) {
        throw new ForbiddenException('Driver not eligible to accept jobs');
      }

      // Prevent driver from holding multiple active jobs simultaneously
      const existingActive = await tx.deliveryJob.findFirst({
        where: {
          driverId,
          status: { in: [DeliveryJobStatus.ACCEPTED, DeliveryJobStatus.PICKUP_CONFIRMED, DeliveryJobStatus.IN_TRANSIT, DeliveryJobStatus.DELIVERED] },
        },
      });
      if (existingActive) {
        throw new BadRequestException('You already have an active job in progress');
      }

      const job = await tx.deliveryJob.findUnique({ where: { id: jobId } });
      if (!job) throw new NotFoundException('Job not found');
      if (job.status !== DeliveryJobStatus.BROADCAST) {
        throw new BadRequestException('Job is no longer available');
      }

      // COD exposure check (uses freshly fetched driver inside tx)
      if (job.mode === DeliveryMode.CASH_ON_DELIVERY) {
        const limit = COD_TIER_LIMITS[driver.tier] ?? 50;
        const newExposure = Number(driver.codCashHeld) + Number(job.itemAmount);
        if (newExposure > limit) {
          throw new BadRequestException(
            `COD exposure limit exceeded for ${driver.tier} tier ($${limit})`,
          );
        }
      }

      const updated = await tx.deliveryJob.update({
        where: { id: jobId },
        data: {
          driverId,
          status: DeliveryJobStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
        include: {
          seller: { select: { firstName: true, lastName: true, phone: true } },
          buyer: { select: { firstName: true, lastName: true, phone: true } },
        },
      });

      // Create COD tracking record
      if (job.mode === DeliveryMode.CASH_ON_DELIVERY) {
        await tx.cODTransaction.create({
          data: {
            jobId,
            driverId,
            cashAmount: job.itemAmount,
            remittanceStatus: CODRemittanceStatus.PENDING,
          },
        });
      }

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Submit pickup proof ──────────────────────────────────────────────────

  async confirmPickup(
    jobId: string,
    driverId: string,
    data: { photoUrl: string; gpsLat: number; gpsLng: number },
  ) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$transaction(
      async (tx) => {
      const job = await tx.deliveryJob.findUnique({ where: { id: jobId } });
      if (!job || job.driverId !== driverId) throw new ForbiddenException();
      if (job.status !== DeliveryJobStatus.ACCEPTED) {
        throw new BadRequestException('Job must be accepted before pickup can be confirmed');
      }

      const updated = await tx.deliveryJob.update({
        where: { id: jobId },
        data: {
          status: DeliveryJobStatus.PICKUP_CONFIRMED,
          pickupPhotoUrl: data.photoUrl,
          pickupTimestamp: new Date(),
          pickupGpsLat: new Prisma.Decimal(data.gpsLat),
          pickupGpsLng: new Prisma.Decimal(data.gpsLng),
        },
      });

      await this.notifications.send(
        job.buyerId,
        NotificationType.JOB_PICKUP_CONFIRMED,
        'Your order is on the way',
        'Driver has picked up your order.',
        { jobId },
      );

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Submit delivery proof ────────────────────────────────────────────────

  async confirmDelivery(
    jobId: string,
    driverId: string,
    data: { photoUrl: string; gpsLat: number; gpsLng: number },
  ) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$transaction(
      async (tx) => {
        const job = await tx.deliveryJob.findUnique({
          where: { id: jobId },
          include: { escrow: true, codTransaction: true },
        });
        if (!job || job.driverId !== driverId) throw new ForbiddenException();
        if (job.status !== DeliveryJobStatus.PICKUP_CONFIRMED) {
          throw new BadRequestException('Pickup must be confirmed first');
        }

        const updated = await tx.deliveryJob.update({
          where: { id: jobId },
          data: {
            status: DeliveryJobStatus.DELIVERED,
            deliveryPhotoUrl: data.photoUrl,
            deliveryTimestamp: new Date(),
            deliveryGpsLat: new Prisma.Decimal(data.gpsLat),
            deliveryGpsLng: new Prisma.Decimal(data.gpsLng),
          },
        });

        // SafePay: auto-release escrow to seller (buyer has 24h to dispute)
        // In production this would be triggered by buyer confirmation or timer
        if (job.mode === DeliveryMode.SAFE_PAY && job.escrow) {
          await this.releaseEscrow(jobId, tx);
        }

        // Credit driver earnings
        await this.creditDriverEarning(job, tx);

        await this.notifications.send(
          job.buyerId,
          NotificationType.JOB_DELIVERED,
          'Order delivered',
          'Your order has been delivered. Confirm receipt in the app.',
          { jobId },
        );

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Buyer confirms receipt ───────────────────────────────────────────────

  async buyerConfirm(jobId: string, buyerId: string) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$transaction(
      async (tx) => {
        const job = await tx.deliveryJob.findUnique({
          where: { id: jobId },
          include: { escrow: true },
        });
        if (!job || job.buyerId !== buyerId) throw new ForbiddenException();
        if (job.status !== DeliveryJobStatus.DELIVERED) {
          throw new BadRequestException('Nothing to confirm yet');
        }

        await tx.deliveryJob.update({
          where: { id: jobId },
          data: { status: DeliveryJobStatus.COMPLETED, completedAt: new Date() },
        });

        // Release escrow if not already released
        if (job.escrow?.status === EscrowStatus.HELD) {
          await this.releaseEscrow(jobId, tx);
        }

        // Update driver stats
        if (job.driverId) {
          await tx.driver.update({
            where: { id: job.driverId },
            data: { completedJobs: { increment: 1 } },
          });
        }

        return { success: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Cancel job ───────────────────────────────────────────────────────────

  async cancelJob(jobId: string, userId: string, reason: string) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$transaction(
      async (tx) => {
        const job = await tx.deliveryJob.findUnique({
          where: { id: jobId },
          include: { escrow: true, driver: true },
        });
        if (!job) throw new NotFoundException('Job not found');
        const cancellableStatuses: DeliveryJobStatus[] = [DeliveryJobStatus.BROADCAST, DeliveryJobStatus.ACCEPTED];
        if (!cancellableStatuses.includes(job.status)) {
          throw new BadRequestException('Job cannot be cancelled at this stage');
        }

        await tx.deliveryJob.update({
          where: { id: jobId },
          data: { status: DeliveryJobStatus.CANCELLED, cancelReason: reason },
        });

        // Refund escrow to buyer
        if (job.escrow?.status === EscrowStatus.HELD) {
          await tx.escrowAccount.update({
            where: { id: job.escrow.id },
            data: { status: EscrowStatus.REFUNDED_TO_BUYER, releasedAt: new Date() },
          });
          await this.wallet.creditEscrowRefund(job.buyerId, Number(job.escrow.totalHeld), jobId, tx);
        }

        // Notify
        const otherId = job.buyerId === userId ? job.sellerId : job.buyerId;
        await this.notifications.send(
          otherId,
          NotificationType.JOB_CANCELLED,
          'Delivery cancelled',
          reason,
          { jobId },
        );

        return { success: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Get job details ──────────────────────────────────────────────────────

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.deliveryJob.findUnique({
      where: { id: jobId },
      include: {
        escrow: true,
        codTransaction: true,
        dispute: true,
        driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        seller: { select: { firstName: true, lastName: true, phone: true } },
        buyer: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');

    // Only buyer, seller, driver, and admins can view
    const isParty = [job.buyerId, job.sellerId].includes(userId) || job.driver?.userId === userId;
    if (!isParty) throw new ForbiddenException();

    // Mask address from non-driver until accepted
    if (job.driver?.userId !== userId && job.status === DeliveryJobStatus.BROADCAST) {
      return { ...job, pickupAddress: null, dropAddress: null };
    }

    return job;
  }

  // ─── My jobs ──────────────────────────────────────────────────────────────

  async getMyJobs(userId: string, role: 'buyer' | 'seller' | 'driver') {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    if (role === 'driver') {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      if (!driver) throw new NotFoundException('Driver profile not found');
      return this.prisma.deliveryJob.findMany({
        where: { driverId: driver.id },
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { firstName: true, lastName: true } },
          buyer: { select: { firstName: true, lastName: true } },
          codTransaction: true,
        },
      });
    }

    const where = role === 'buyer' ? { buyerId: userId } : { sellerId: userId };
    return this.prisma.deliveryJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { include: { user: { select: { firstName: true, lastName: true } } } },
        escrow: true,
        dispute: true,
      },
    });
  }

  // ─── Escrow release ───────────────────────────────────────────────────────

  private async releaseEscrow(jobId: string, tx: Prisma.TransactionClient) {
    const job = await tx.deliveryJob.findUnique({
      where: { id: jobId },
      include: { escrow: true },
    });
    if (!job?.escrow || job.escrow.status !== EscrowStatus.HELD) return;

    await tx.escrowAccount.update({
      where: { id: job.escrow.id },
      data: { status: EscrowStatus.RELEASED_TO_SELLER, releasedAt: new Date() },
    });

    // Pay seller (item amount minus platform fee)
    const sellerAmount = Number(job.escrow.itemAmount) - Number(job.escrow.platformFee);
    await this.wallet.creditEscrowRelease(job.sellerId, sellerAmount, jobId, tx);

    // Split reserve to risk pool
    const useReserves = await this.getFlag(FLAGS.RISK_RESERVES);
    if (useReserves) {
      const reservePool = await tx.riskReservePool.findFirst();
      if (reservePool) {
        await tx.riskReservePool.update({
          where: { id: reservePool.id },
          data: {
            balance: { increment: job.escrow.reserveAmt },
            totalIn: { increment: job.escrow.reserveAmt },
          },
        });
      } else {
        await tx.riskReservePool.create({
          data: {
            balance: job.escrow.reserveAmt,
            totalIn: job.escrow.reserveAmt,
          },
        });
      }
    }
  }

  // ─── Driver earning credit ────────────────────────────────────────────────

  private async creditDriverEarning(job: any, tx: Prisma.TransactionClient) {
    if (!job.driverId) return;

    await this.wallet.creditDriverEarning(
      job.driver?.userId ?? job.driverId,
      Number(job.driverEarning),
      job.id,
      tx,
    );

    await tx.driver.update({
      where: { id: job.driverId },
      data: { totalEarnings: { increment: job.driverEarning } },
    });

    // Auto-hold float (10% of earning)
    const useFloat = await this.getFlag(FLAGS.DRIVER_FLOAT);
    if (useFloat) {
      const holdAmt = Number((Number(job.driverEarning) * FLOAT_AUTO_HOLD_RATE).toFixed(2));
      await tx.driver.update({
        where: { id: job.driverId },
        data: { floatBalance: { increment: holdAmt } },
      });
      await tx.driverFloatTransaction.create({
        data: {
          driverId: job.driverId,
          amount: new Prisma.Decimal(holdAmt),
          type: 'HOLD',
          reference: job.id,
          description: 'Auto float hold (10% of earning)',
        },
      });
    }
  }
}
