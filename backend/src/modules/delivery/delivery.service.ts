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

// Financial constants â€” DB-overridable via AppSetting keys:
// delivery_platform_fee_rate (default 0.03), delivery_reserve_rate (default 0.02), delivery_driver_float_rate (default 0.10)
const DEFAULT_PLATFORM_FEE_RATE = 0.03;
const DEFAULT_RESERVE_RATE = 0.02;
const DEFAULT_FLOAT_AUTO_HOLD_RATE = 0.10;
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

  // â”€â”€â”€ Feature flag helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async getFlag(key: string): Promise<boolean> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key } });
    return setting?.value === 'true';
  }

  private async requireFlag(key: string) {
    const enabled = await this.getFlag(key);
    if (!enabled) throw new BadRequestException(`Feature ${key} is not enabled`);
  }

  private async getRate(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    if (row) {
      const n = parseFloat(row.value);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
    }
    return fallback;
  }

  private async getFinancialRates() {
    const [platformFeeRate, reserveRate, floatAutoHoldRate] = await Promise.all([
      this.getRate('delivery_platform_fee_rate', DEFAULT_PLATFORM_FEE_RATE),
      this.getRate('delivery_reserve_rate', DEFAULT_RESERVE_RATE),
      this.getRate('delivery_driver_float_rate', DEFAULT_FLOAT_AUTO_HOLD_RATE),
    ]);
    return { platformFeeRate, reserveRate, floatAutoHoldRate };
  }

  // â”€â”€â”€ Job creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createJob(params: {
    orderId: string;
    orderType: 'OFFER' | 'POS_SALE';
    /** buyerId is always the authenticated user â€” set by the controller from JWT. */
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

    // Resolve sellerId from the order â€” never trust client-supplied values.
    let sellerId: string;
    if (params.orderType === 'OFFER') {
      const offer = await this.prisma.sellerOffer.findUnique({
        where: { id: params.orderId },
        include: {
          stall: { select: { merchant: { select: { userId: true } } } },
          demand: { select: { buyerId: true } },
        },
      });
      if (!offer) throw new NotFoundException('Offer not found');
      if (offer.demand.buyerId !== params.buyerId) throw new ForbiddenException('This offer does not belong to you');
      sellerId = offer.stall.merchant.userId;
    } else {
      const sale = await this.prisma.pOSSale.findUnique({
        where: { id: params.orderId },
        include: { stall: { select: { merchant: { select: { userId: true } } } } },
      });
      if (!sale) throw new NotFoundException('POS sale not found');
      if (sale.cashierId !== params.buyerId && sale.stall.merchant.userId !== params.buyerId) {
        throw new ForbiddenException('You are not a party to this sale');
      }
      sellerId = sale.stall.merchant.userId;
    }

    if (params.mode === DeliveryMode.DIRECT_DEAL) {
      await this.requireFlag(FLAGS.DIRECT_DEAL);
    }
    // Bind the resolved sellerId into params for the rest of createJob.
    const resolvedParams = { ...params, sellerId };
    if (params.mode === DeliveryMode.SAFE_PAY) {
      await this.requireFlag(FLAGS.SAFE_PAY);
    }
    if (params.mode === DeliveryMode.CASH_ON_DELIVERY) {
      await this.requireFlag(FLAGS.COD);
    }

    const { platformFeeRate, reserveRate } = await this.getFinancialRates();
    const platformFee = Number((resolvedParams.itemAmount * platformFeeRate).toFixed(2));
    const reserveAmount = Number((resolvedParams.itemAmount * reserveRate).toFixed(2));
    const driverEarning = Number((resolvedParams.deliveryFee * 0.85).toFixed(2)); // driver gets 85% of delivery fee

    const job = await this.prisma.$retryTransaction(
      async (tx) => {
      const deliveryJob = await tx.deliveryJob.create({
        data: {
          orderId: resolvedParams.orderId,
          orderType: resolvedParams.orderType,
          sellerId: resolvedParams.sellerId,
          buyerId: resolvedParams.buyerId,
          mode: resolvedParams.mode,
          status: resolvedParams.mode === DeliveryMode.DIRECT_DEAL
            ? DeliveryJobStatus.COMPLETED  // Direct deal needs no driver
            : DeliveryJobStatus.BROADCAST,
          pickupZone: resolvedParams.pickupZone,
          dropZone: resolvedParams.dropZone,
          pickupAddress: resolvedParams.pickupAddress,
          dropAddress: resolvedParams.dropAddress,
          pickupLat: resolvedParams.pickupLat ? new Prisma.Decimal(resolvedParams.pickupLat) : null,
          pickupLng: resolvedParams.pickupLng ? new Prisma.Decimal(resolvedParams.pickupLng) : null,
          dropLat: resolvedParams.dropLat ? new Prisma.Decimal(resolvedParams.dropLat) : null,
          dropLng: resolvedParams.dropLng ? new Prisma.Decimal(resolvedParams.dropLng) : null,
          distanceKm: resolvedParams.distanceKm ? new Prisma.Decimal(resolvedParams.distanceKm) : null,
          itemAmount: new Prisma.Decimal(resolvedParams.itemAmount),
          deliveryFee: new Prisma.Decimal(resolvedParams.deliveryFee),
          platformFee: new Prisma.Decimal(platformFee),
          reserveAmount: new Prisma.Decimal(reserveAmount),
          driverEarning: new Prisma.Decimal(driverEarning),
          broadcastedAt: resolvedParams.mode !== DeliveryMode.DIRECT_DEAL ? new Date() : null,
        },
      });

      // Lock buyer funds in escrow for SafePay
      if (resolvedParams.mode === DeliveryMode.SAFE_PAY) {
        const totalHeld = resolvedParams.itemAmount + resolvedParams.deliveryFee + platformFee;
        await tx.escrowAccount.create({
          data: {
            jobId: deliveryJob.id,
            buyerId: resolvedParams.buyerId,
            totalHeld: new Prisma.Decimal(totalHeld),
            itemAmount: new Prisma.Decimal(params.itemAmount),
            deliveryFee: new Prisma.Decimal(params.deliveryFee),
            platformFee: new Prisma.Decimal(platformFee),
            reserveAmt: new Prisma.Decimal(reserveAmount),
            status: EscrowStatus.HELD,
          },
        });

        // Debit buyer wallet
        await this.wallet.debitForEscrow(resolvedParams.buyerId, totalHeld, deliveryJob.id, tx);
      }

      return deliveryJob;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Notify nearby drivers (broadcast)
    if (job.status === DeliveryJobStatus.BROADCAST) {
      await this.broadcastToDrivers(job.id, resolvedParams.pickupZone, resolvedParams.pickupLat, resolvedParams.pickupLng);
    }

    return job;
  }

  // â”€â”€â”€ Admin list all jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async listAllJobs(params: { status?: string; limit?: number; page?: number }) {
    const limit = Math.min(params.limit ?? 50, 200);
    const page = Math.max(params.page ?? 1, 1);
    const where: any = {};
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.deliveryJob.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { firstName: true, lastName: true, phone: true } },
          buyer: { select: { firstName: true, lastName: true, phone: true } },
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
          escrow: { select: { status: true, totalHeld: true } },
        },
      }),
      this.prisma.deliveryJob.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // â”€â”€â”€ Broadcast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ Get broadcast jobs (driver view â€” zones only, radius-filtered) â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        // Strip GPS coords â€” drivers don't need them before accepting
        const { pickupLat, pickupLng, ...safe } = j;
        return { ...safe, distFromDriverKm: distFromDriver, radiusKm };
      });
  }

  // â”€â”€â”€ Accept job â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async acceptJob(jobId: string, driverId: string) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$retryTransaction(async (tx) => {
      // Re-fetch driver inside tx so COD exposure check reflects latest state
      const driver = await tx.driver.findUnique({ where: { id: driverId } });
      if (!driver?.isActive || !driver.kycVerified) {
        throw new ForbiddenException('Driver not eligible to accept jobs');
      }

      // When the driver float system is enabled, require a minimum wallet balance
      // so the platform can deduct its 10% commission on successful delivery.
      const floatEnabled = await this.getFlag(FLAGS.DRIVER_FLOAT);
      if (floatEnabled) {
        const wallet = await tx.wallet.findUnique({ where: { userId: driver.userId } });
        if (!wallet || wallet.availableBalance.lessThan(1)) {
          throw new BadRequestException(
            'Insufficient wallet balance. Top up your wallet (minimum $1.00) to accept delivery jobs — the platform deducts 10% per successful delivery.',
          );
        }
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

  // â”€â”€â”€ Submit pickup proof â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async confirmPickup(
    jobId: string,
    driverId: string,
    data: { photoUrl: string; gpsLat: number; gpsLng: number },
  ) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$retryTransaction(
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

  // â”€â”€â”€ Submit delivery proof â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async confirmDelivery(
    jobId: string,
    driverId: string,
    data: { photoUrl: string; gpsLat: number; gpsLng: number },
  ) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$retryTransaction(
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

  // â”€â”€â”€ Buyer confirms receipt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async buyerConfirm(jobId: string, buyerId: string) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$retryTransaction(
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

  // â”€â”€â”€ Cancel job â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async cancelJob(jobId: string, userId: string, reason: string) {
    await this.requireFlag(FLAGS.DELIVERY_LAYER);

    return this.prisma.$retryTransaction(
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

  // â”€â”€â”€ Get job details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ My jobs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ Escrow release â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€ Driver earning credit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // Auto-hold float from DB-configured rate
    const useFloat = await this.getFlag(FLAGS.DRIVER_FLOAT);
    if (useFloat) {
      const floatRate = await this.getRate('delivery_driver_float_rate', DEFAULT_FLOAT_AUTO_HOLD_RATE);
      const holdAmt = Number((Number(job.driverEarning) * floatRate).toFixed(2));
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
