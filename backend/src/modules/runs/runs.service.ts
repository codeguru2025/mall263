import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DeliveryMode,
  RunStatus,
  RunBidStatus,
  RunStopStatus,
  RunQrTokenType,
  EscrowStatus,
  NotificationType,
  Prisma,
  WalletTransactionType,
  WalletTransactionStatus,
} from '@prisma/client';
import { CreateRunDto } from './dto/create-run.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { randomUUID } from 'crypto';

/** Base fee (USD) + per-km rate for suggested delivery fee calculation. */
const BASE_FEE_USD = 1.0;
const PER_KM_RATE_USD = 0.8;
const PLATFORM_FEE_RATE = 0.05; // 5% of delivery fee
const AUTO_CONFIRM_HOURS = 24;

/** Haversine great-circle distance in km. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateCollectionCode(name: string): string {
  const prefix = name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  // 8-char UUID hex suffix → ~4 billion combinations, collision-proof in practice
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${prefix}-${suffix}`;
}

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async createRun(buyerId: string, dto: CreateRunDto) {
    // Validate pickup point when specified
    let pickupPoint: { id: string; name: string; address: string } | null = null;
    if (dto.pickupPointId) {
      pickupPoint = await this.prisma.pickupPoint.findFirst({
        where: { id: dto.pickupPointId, isActive: true },
        select: { id: true, name: true, address: true },
      });
      if (!pickupPoint) throw new NotFoundException('Pickup point not found or inactive');
    } else if (!dto.dropZone) {
      throw new BadRequestException('dropZone is required when no pickup point is selected');
    }

    // Validate all stalls exist and have GPS coords for route calculation
    const stallIds = dto.stops.map((s) => s.stallId);
    const uniqueStallIds = [...new Set(stallIds)];
    const stalls = await this.prisma.stall.findMany({
      where: { id: { in: uniqueStallIds } },
      select: { id: true, name: true, latitude: true, longitude: true, address: true, mall: { select: { city: true, name: true } } },
    });
    if (stalls.length !== uniqueStallIds.length) throw new NotFoundException('One or more stalls not found');

    // Validate all variants exist
    const allVariantIds = dto.stops.flatMap((s) => s.items.map((i) => i.variantId));
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: allVariantIds } },
      select: { id: true, sellingPrice: true, currency: true, isActive: true, inventory: { select: { quantity: true } } },
    });
    if (variants.length !== allVariantIds.length) throw new NotFoundException('One or more product variants not found');
    for (const v of variants) {
      if (!v.isActive) throw new BadRequestException(`Variant ${v.id} is not active`);
    }

    // Compute route distance: stop1→stop2→...→stopN→dropoff
    const sortedStops = [...dto.stops].sort((a, b) => a.stopOrder - b.stopOrder);
    let totalDistanceKm = 0;
    const stopCoords: { lat: number; lng: number }[] = [];

    for (const stop of sortedStops) {
      const stall = stalls.find((s) => s.id === stop.stallId)!;
      if (stall.latitude && stall.longitude) {
        stopCoords.push({ lat: stall.latitude, lng: stall.longitude });
      }
    }
    if (dto.dropLat && dto.dropLng) {
      stopCoords.push({ lat: dto.dropLat, lng: dto.dropLng });
    }
    for (let i = 0; i < stopCoords.length - 1; i++) {
      totalDistanceKm += haversineKm(
        stopCoords[i].lat, stopCoords[i].lng,
        stopCoords[i + 1].lat, stopCoords[i + 1].lng,
      );
    }

    const suggestedFee = parseFloat(
      (BASE_FEE_USD + PER_KM_RATE_USD * totalDistanceKm).toFixed(2),
    );

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const collectionToken = pickupPoint ? randomUUID() : null;
    const collectionCode = pickupPoint ? generateCollectionCode(pickupPoint.name) : null;

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.run.create({
        data: {
          buyerId,
          mode: dto.mode,
          status: RunStatus.OPEN,
          dropZone: pickupPoint ? pickupPoint.name : dto.dropZone!,
          dropAddress: pickupPoint ? pickupPoint.address : dto.dropAddress,
          dropLat: dto.dropLat ? new Prisma.Decimal(dto.dropLat) : null,
          dropLng: dto.dropLng ? new Prisma.Decimal(dto.dropLng) : null,
          totalDistanceKm: new Prisma.Decimal(totalDistanceKm.toFixed(2)),
          suggestedFee: new Prisma.Decimal(suggestedFee),
          maxBudget: dto.maxBudget ? new Prisma.Decimal(dto.maxBudget) : null,
          pickupPointId: pickupPoint?.id ?? null,
          collectionToken,
          collectionCode,
          stops: {
            create: sortedStops.map((stop) => {
              const stall = stalls.find((s) => s.id === stop.stallId)!;
              const itemAmount = stop.items.reduce((sum, item) => {
                const v = variantMap.get(item.variantId)!;
                return sum.add(v.sellingPrice.mul(item.quantity));
              }, new Prisma.Decimal(0));
              return {
                stallId: stop.stallId,
                stopOrder: stop.stopOrder,
                pickupPin: randomPin(),
                itemAmount,
                items: {
                  create: stop.items.map((item) => {
                    const v = variantMap.get(item.variantId)!;
                    return {
                      variantId: item.variantId,
                      quantity: item.quantity,
                      unitPrice: v.sellingPrice,
                      currency: v.currency,
                    };
                  }),
                },
              };
            }),
          },
        },
        include: {
          stops: { include: { items: true, stall: { select: { id: true, name: true, latitude: true, longitude: true } } } },
        },
      });
      return run;
    });
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  async getMyRuns(buyerId: string) {
    return this.prisma.run.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
      include: {
        stops: { select: { id: true, stallId: true, stopOrder: true, status: true, itemAmount: true, stall: { select: { name: true } } } },
        bids: { where: { status: RunBidStatus.PENDING }, select: { id: true } },
        _count: { select: { bids: true } },
      },
    });
  }

  async getOpenRunsForDriver(driverId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    return this.prisma.run.findMany({
      where: { status: RunStatus.OPEN },
      orderBy: { createdAt: 'desc' },
      include: {
        stops: {
          orderBy: { stopOrder: 'asc' },
          select: {
            id: true, stopOrder: true, itemAmount: true,
            stall: { select: { name: true, latitude: true, longitude: true, mall: { select: { name: true, city: true } } } },
            items: { include: { variant: { select: { name: true, sellingPrice: true, currency: true, product: { select: { name: true, images: { take: 1, select: { url: true } } } } } } } },
          },
        },
        bids: { where: { driverId }, select: { id: true, fee: true, status: true } },
        _count: { select: { bids: true } },
      },
    });
  }

  async getRunById(runId: string, requesterId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        stops: {
          orderBy: { stopOrder: 'asc' },
          include: {
            stall: { select: { id: true, name: true, latitude: true, longitude: true, address: true, phone: true } },
            items: { include: { variant: { select: { name: true, sellingPrice: true, currency: true, product: { select: { name: true, images: { take: 1, select: { url: true } } } } } } } },
          },
        },
        bids: {
          orderBy: { fee: 'asc' },
          include: { driver: { select: { id: true, tier: true, rating: true, completedJobs: true, user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } } },
        },
        escrow: true,
        driver: { select: { id: true, tier: true, rating: true, currentLat: true, currentLng: true, user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
        pickupPoint: { select: { id: true, name: true, address: true } },
      },
    });
    if (!run) throw new NotFoundException('Run not found');

    // Compare by userId throughout — run.driverId is a driver-table PK, not a user PK.
    // driver.user.id is included in the query so we can do the right comparison.
    const assignedDriverUserId = run.driver?.user.id ?? null;
    const isAssignedDriver = assignedDriverUserId === requesterId;
    const isBuyer = run.buyerId === requesterId;
    // A driver who bid but was not selected can see limited info (zone only, no address)
    const isBiddingDriver =
      !isAssignedDriver && run.bids.some((b) => b.driver.user.id === requesterId);

    if (!isBuyer && !isAssignedDriver && !isBiddingDriver) {
      throw new ForbiddenException('Access denied');
    }

    // Bidding-but-not-selected drivers: zone info only, no address or PINs
    if (isBiddingDriver) {
      return {
        ...run,
        dropAddress: null,
        dropLat: null,
        dropLng: null,
        stops: run.stops.map((s) => ({ ...s, pickupPin: undefined })),
      };
    }

    // Buyer doesn't need PINs (sellers confirm via seller endpoint)
    if (isBuyer) {
      return {
        ...run,
        stops: run.stops.map((s) => ({ ...s, pickupPin: undefined })),
      };
    }

    return run;
  }

  async getStallRunStops(stallOwnerId: string) {
    // Find all stalls owned by this merchant
    const merchant = await this.prisma.merchant.findFirst({
      where: { userId: stallOwnerId },
      select: { stalls: { select: { id: true } } },
    });
    if (!merchant) return [];
    const stallIds = merchant.stalls.map((s) => s.id);

    return this.prisma.runStop.findMany({
      where: {
        stallId: { in: stallIds },
        run: { status: { in: [RunStatus.LOCKED, RunStatus.IN_PROGRESS] } },
      },
      include: {
        run: { select: { id: true, status: true, mode: true, dropZone: true, buyer: { select: { firstName: true, lastName: true } } } },
        stall: { select: { id: true, name: true } },
        items: { include: { variant: { select: { name: true, product: { select: { name: true, images: { take: 1, select: { url: true } } } } } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Bidding ───────────────────────────────────────────────────────────────

  async placeBid(driverId: string, runId: string, dto: PlaceBidDto) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Run not found');
    if (run.status !== RunStatus.OPEN) throw new BadRequestException('Run is no longer accepting bids');
    if (run.maxBudget && run.maxBudget.greaterThan(0) && new Prisma.Decimal(dto.fee).greaterThan(run.maxBudget)) {
      throw new BadRequestException(`Bid exceeds the buyer's max budget of ${run.maxBudget}`);
    }

    const bid = await this.prisma.runBid.upsert({
      where: { runId_driverId: { runId, driverId } },
      create: { runId, driverId, fee: new Prisma.Decimal(dto.fee), message: dto.message, status: RunBidStatus.PENDING },
      update: { fee: new Prisma.Decimal(dto.fee), message: dto.message, status: RunBidStatus.PENDING },
    });

    await this.notifications.send(run.buyerId, NotificationType.RUN_BID_RECEIVED, 'New bid on your run', `A driver offered $${dto.fee.toFixed(2)} for your delivery run`, { runId });

    return bid;
  }

  async withdrawBid(driverId: string, runId: string) {
    const bid = await this.prisma.runBid.findUnique({ where: { runId_driverId: { runId, driverId } } });
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.status !== RunBidStatus.PENDING) throw new BadRequestException('Bid is no longer pending');
    return this.prisma.runBid.update({
      where: { id: bid.id },
      data: { status: RunBidStatus.WITHDRAWN },
    });
  }

  async acceptBid(buyerId: string, runId: string, bidId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { stops: { select: { id: true, itemAmount: true } } },
    });
    if (!run) throw new NotFoundException('Run not found');
    if (run.buyerId !== buyerId) throw new ForbiddenException('Not your run');
    if (run.status !== RunStatus.OPEN) throw new BadRequestException('Run is not open for bid acceptance');

    const bid = await this.prisma.runBid.findUnique({ where: { id: bidId }, include: { driver: { include: { user: true } } } });
    if (!bid || bid.runId !== runId) throw new NotFoundException('Bid not found');
    if (bid.status !== RunBidStatus.PENDING) throw new BadRequestException('Bid is no longer pending');

    const agreedFeeDec = bid.fee; // Already Prisma.Decimal from DB
    const platformFeeDec = agreedFeeDec.mul(PLATFORM_FEE_RATE).toDecimalPlaces(2);
    const driverEarningDec = agreedFeeDec.sub(platformFeeDec);
    const itemAmountDec = run.stops.reduce(
      (sum, s) => sum.add(s.itemAmount),
      new Prisma.Decimal(0),
    );
    const totalHeldDec = itemAmountDec.add(agreedFeeDec);

    return this.prisma.$retryTransaction(
      async (tx) => {
        // Re-check status inside transaction
        const freshRun = await tx.run.findUnique({ where: { id: runId }, select: { status: true } });
        if (freshRun?.status !== RunStatus.OPEN) throw new BadRequestException('Run is no longer open');

        if (run.mode === DeliveryMode.SAFE_PAY) {
          // Lock funds in buyer wallet — re-fetch inside tx for current balance
          const wallet = await tx.wallet.findFirst({ where: { userId: buyerId } });
          if (!wallet) throw new BadRequestException('Buyer wallet not found');
          if (wallet.availableBalance.lessThan(totalHeldDec)) {
            throw new BadRequestException(`Insufficient wallet balance. Need $${totalHeldDec.toFixed(2)}`);
          }
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              availableBalance: { decrement: totalHeldDec },
              lockedBalance: { increment: totalHeldDec },
            },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: WalletTransactionType.RUN_ESCROW_LOCK,
              amount: totalHeldDec,
              balanceBefore: wallet.availableBalance,
              balanceAfter: wallet.availableBalance.sub(totalHeldDec),
              status: WalletTransactionStatus.COMPLETED,
              description: `Run escrow locked (delivery + items) — run ${runId}`,
              referenceId: runId,
              referenceType: 'run',
              completedAt: new Date(),
            },
          });
          await tx.runEscrow.create({
            data: {
              runId,
              buyerId,
              totalHeld: totalHeldDec,
              itemAmount: itemAmountDec,
              deliveryFee: agreedFeeDec,
              platformFee: platformFeeDec,
              status: EscrowStatus.HELD,
            },
          });
        }

        // Generate pickup PINs for each stop (replace the placeholder ones)
        for (const stop of run.stops) {
          await tx.runStop.update({
            where: { id: stop.id },
            data: { pickupPin: randomPin() },
          });
        }

        // Accept this bid
        await tx.runBid.update({
          where: { id: bidId },
          data: { status: RunBidStatus.ACCEPTED, respondedAt: new Date() },
        });

        // Reject all other pending bids
        await tx.runBid.updateMany({
          where: { runId, id: { not: bidId }, status: RunBidStatus.PENDING },
          data: { status: RunBidStatus.REJECTED, respondedAt: new Date() },
        });

        // Lock the run
        const updatedRun = await tx.run.update({
          where: { id: runId },
          data: {
            status: RunStatus.LOCKED,
            driverId: bid.driverId,
            agreedFee: agreedFeeDec,
            platformFee: platformFeeDec,
            driverEarning: driverEarningDec,
            lockedAt: new Date(),
          },
          include: { stops: true },
        });

        // Notify the winning driver
        await this.notifications.send(bid.driver.userId, NotificationType.RUN_BID_ACCEPTED, 'Your run bid was accepted!', `You got the job. Pick up from ${run.stops.length} stop(s) and deliver.`, { runId },);

        return updatedRun;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getDriverActiveRun(driverId: string) {
    return this.prisma.run.findFirst({
      where: {
        driverId,
        status: { in: [RunStatus.LOCKED, RunStatus.IN_PROGRESS, RunStatus.DELIVERED] },
      },
      include: {
        stops: {
          orderBy: { stopOrder: 'asc' },
          include: {
            stall: { select: { id: true, name: true, address: true, latitude: true, longitude: true, phone: true } },
            items: {
              include: {
                variant: {
                  select: {
                    name: true,
                    sellingPrice: true,
                    currency: true,
                    product: { select: { name: true, images: { take: 1, select: { url: true } } } },
                  },
                },
              },
            },
          },
        },
        buyer: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
  }

  // ─── Driver workflow ────────────────────────────────────────────────────────

  async confirmStopPickup(driverId: string, runId: string, stopId: string, dto: ConfirmPickupDto) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('Run not found');
    if (run.driverId !== driverId) throw new ForbiddenException('Not your run');
    if (run.status !== RunStatus.LOCKED && run.status !== RunStatus.IN_PROGRESS) {
      throw new BadRequestException('Run is not in a state that allows pickup confirmations');
    }

    const stop = await this.prisma.runStop.findUnique({ where: { id: stopId } });
    if (!stop || stop.runId !== runId) throw new NotFoundException('Stop not found');
    if (stop.status === RunStopStatus.PICKED_UP) throw new BadRequestException('Stop already confirmed');
    if (stop.pickupPin !== dto.pin) throw new ForbiddenException('Incorrect pickup PIN');

    await this.prisma.runStop.update({
      where: { id: stopId },
      data: {
        status: RunStopStatus.PICKED_UP,
        pickedUpAt: new Date(),
        pickupGpsLat: dto.gpsLat ? new Prisma.Decimal(dto.gpsLat) : null,
        pickupGpsLng: dto.gpsLng ? new Prisma.Decimal(dto.gpsLng) : null,
      },
    });

    // Check if all stops are picked up → transition to IN_PROGRESS
    const remainingStops = await this.prisma.runStop.count({
      where: { runId, status: RunStopStatus.PENDING },
    });
    if (remainingStops === 0) {
      await this.prisma.run.update({ where: { id: runId }, data: { status: RunStatus.IN_PROGRESS } });
      await this.notifications.send(run.buyerId, NotificationType.RUN_STOP_PICKED_UP, 'All items picked up', 'Your driver has collected everything and is on the way!', { runId },);
    } else {
      await this.notifications.send(run.buyerId, NotificationType.RUN_STOP_PICKED_UP, 'Stop picked up', `${remainingStops} stop(s) remaining before delivery.`, { runId },);
    }

    return { remainingStops };
  }

  async submitDeliveryProof(
    driverId: string,
    runId: string,
    data: { photoUrl?: string; videoUrl?: string; gpsLat?: number; gpsLng?: number },
  ) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { pickupPoint: { select: { id: true, name: true } } },
    });
    if (!run) throw new NotFoundException('Run not found');
    if (run.driverId !== driverId) throw new ForbiddenException('Not your run');
    if (run.status !== RunStatus.IN_PROGRESS) throw new BadRequestException('Run is not in progress');

    // Pickup-point run: driver drops off at the named location, buyer collects later
    if (run.pickupPointId && run.pickupPoint) {
      const updated = await this.prisma.run.update({
        where: { id: runId },
        data: { status: RunStatus.AT_PICKUP_POINT },
      });
      await this.notifications.send(
        run.buyerId,
        NotificationType.RUN_READY_FOR_COLLECTION,
        'Your order is ready for collection',
        `Your order is at ${run.pickupPoint.name}. Show your collection QR (code: ${run.collectionCode}) when you arrive.`,
        { runId, pickupPointName: run.pickupPoint.name, collectionCode: run.collectionCode, collectionToken: run.collectionToken },
      );
      return updated;
    }

    // Standard home-delivery run
    const updated = await this.prisma.run.update({
      where: { id: runId },
      data: {
        status: RunStatus.DELIVERED,
        deliveryPhotoUrl: data.photoUrl,
        deliveryVideoUrl: data.videoUrl,
        deliveryTimestamp: new Date(),
        deliveryGpsLat: data.gpsLat ? new Prisma.Decimal(data.gpsLat) : null,
        deliveryGpsLng: data.gpsLng ? new Prisma.Decimal(data.gpsLng) : null,
      },
    });

    if (data.photoUrl || data.videoUrl) {
      await this.notifications.send(run.buyerId, NotificationType.RUN_DELIVERY_PROOF, 'Delivery proof attached', 'Your driver uploaded proof of delivery. Tap to review.', { runId, photoUrl: data.photoUrl, videoUrl: data.videoUrl });
    }
    await this.notifications.send(run.buyerId, NotificationType.RUN_DELIVERED, 'Your run has been delivered!', 'Confirm receipt to release payment, or it auto-confirms in 24h.', { runId });

    return updated;
  }

  // ─── QR Token handoff ──────────────────────────────────────────────────────

  private async _resolveDriverId(userId: string): Promise<string> {
    const driver = await this.prisma.driver.findFirst({ where: { userId }, select: { id: true } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver.id;
  }

  async getStopQrToken(userId: string, runId: string, stopId: string) {
    const run = await this.prisma.run.findUnique({ where: { id: runId }, select: { driverId: true, status: true } });
    if (!run) throw new NotFoundException('Run not found');
    if (run.driverId !== userId) throw new ForbiddenException('Not your run');
    if (run.status !== RunStatus.LOCKED && run.status !== RunStatus.IN_PROGRESS) {
      throw new BadRequestException('Run is not active');
    }

    const stop = await this.prisma.runStop.findUnique({ where: { id: stopId }, select: { id: true, runId: true, status: true } });
    if (!stop || stop.runId !== runId) throw new NotFoundException('Stop not found');
    if (stop.status === RunStopStatus.PICKED_UP) throw new BadRequestException('Stop already confirmed');

    const driverId = await this._resolveDriverId(userId);

    let qr = await this.prisma.runQrToken.findFirst({
      where: { runId, stopId, type: RunQrTokenType.PICKUP, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!qr) {
      qr = await this.prisma.runQrToken.create({
        data: {
          type: RunQrTokenType.PICKUP,
          runId,
          stopId,
          driverId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return { token: qr.token };
  }

  async getDeliveryQrToken(userId: string, runId: string) {
    const run = await this.prisma.run.findUnique({ where: { id: runId }, select: { driverId: true, status: true } });
    if (!run) throw new NotFoundException('Run not found');
    if (run.driverId !== userId) throw new ForbiddenException('Not your run');
    if (run.status !== RunStatus.IN_PROGRESS) throw new BadRequestException('Run is not in progress');

    const driverId = await this._resolveDriverId(userId);

    let qr = await this.prisma.runQrToken.findFirst({
      where: { runId, stopId: null, type: RunQrTokenType.DELIVERY, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!qr) {
      qr = await this.prisma.runQrToken.create({
        data: {
          type: RunQrTokenType.DELIVERY,
          runId,
          driverId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return { token: qr.token };
  }

  async scanQrToken(scannerId: string, token: string) {
    const qr = await this.prisma.runQrToken.findUnique({
      where: { token },
      include: {
        run: {
          select: {
            id: true, buyerId: true, status: true, driverEarning: true, mode: true,
            stops: { select: { id: true, stallId: true, itemAmount: true } },
            escrow: { select: { totalHeld: true, itemAmount: true, deliveryFee: true, platformFee: true } },
            driver: { select: { userId: true } },
          },
        },
        stop: {
          include: {
            stall: {
              select: {
                name: true,
                address: true,
                merchant: { select: { userId: true } },
                attendants: { where: { isActive: true }, select: { userId: true } },
              },
            },
            items: {
              include: {
                variant: { select: { name: true, product: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });

    if (!qr) throw new NotFoundException('Invalid QR code');
    if (qr.usedAt) throw new BadRequestException('QR code already used');
    if (qr.expiresAt < new Date()) throw new BadRequestException('QR code has expired');

    if (qr.type === RunQrTokenType.PICKUP) {
      if (!qr.stopId || !qr.stop) throw new BadRequestException('Malformed pickup QR');
      if (qr.stop.status === RunStopStatus.PICKED_UP) throw new BadRequestException('Stop already marked as picked up');

      // Only the stall's merchant or an active attendant may confirm collection
      const isStallStaff =
        scannerId === qr.stop.stall.merchant.userId ||
        qr.stop.stall.attendants.some((a) => a.userId === scannerId);
      if (!isStallStaff) throw new ForbiddenException('Only stall staff can confirm this pickup');

      await this.prisma.runQrToken.update({ where: { id: qr.id }, data: { usedAt: new Date(), usedById: scannerId } });
      await this.prisma.runStop.update({
        where: { id: qr.stopId },
        data: { status: RunStopStatus.PICKED_UP, pickedUpAt: new Date() },
      });

      const remaining = await this.prisma.runStop.count({ where: { runId: qr.runId, status: RunStopStatus.PENDING } });
      if (remaining === 0) {
        await this.prisma.run.update({ where: { id: qr.runId }, data: { status: RunStatus.IN_PROGRESS } });
        await this.notifications.send(qr.run.buyerId, NotificationType.RUN_STOP_PICKED_UP, 'All items picked up!', 'Your driver has collected everything and is on the way.', { runId: qr.runId });
      } else {
        await this.notifications.send(qr.run.buyerId, NotificationType.RUN_STOP_PICKED_UP, 'Stop picked up', `${remaining} stop(s) remaining before delivery.`, { runId: qr.runId });
      }

      return {
        type: 'PICKUP',
        message: 'Goods confirmed as collected',
        stall: qr.stop.stall.name,
        items: qr.stop.items.map((i) => ({
          name: i.variant.product.name,
          variant: i.variant.name,
          quantity: i.quantity,
        })),
        remainingStops: remaining,
      };
    }

    if (qr.type === RunQrTokenType.DELIVERY) {
      if (qr.run.buyerId !== scannerId) throw new ForbiddenException('Only the buyer can confirm delivery with this code');
      if (qr.run.status !== RunStatus.IN_PROGRESS && qr.run.status !== RunStatus.DELIVERED) {
        throw new BadRequestException('Run is not ready for delivery confirmation');
      }

      await this.prisma.runQrToken.update({ where: { id: qr.id }, data: { usedAt: new Date(), usedById: scannerId } });
      await this._releaseEscrow(qr.run as any);

      return { type: 'DELIVERY', message: 'Delivery confirmed! Payment released.' };
    }

    throw new BadRequestException('Unknown QR token type');
  }

  async uploadCollectionProof(userId: string, runId: string, stopId: string, photoUrl?: string, videoUrl?: string) {
    if (!photoUrl && !videoUrl) throw new BadRequestException('At least one of photoUrl or videoUrl is required');

    const run = await this.prisma.run.findUnique({ where: { id: runId }, select: { driverId: true, buyerId: true } });
    if (!run) throw new NotFoundException('Run not found');
    if (run.driverId !== userId) throw new ForbiddenException('Not your run');

    const stop = await this.prisma.runStop.findUnique({ where: { id: stopId }, select: { id: true, runId: true, collectionPhotoUrl: true, collectionVideoUrl: true } });
    if (!stop || stop.runId !== runId) throw new NotFoundException('Stop not found');

    await this.prisma.runStop.update({
      where: { id: stopId },
      data: {
        collectionPhotoUrl: photoUrl ?? stop.collectionPhotoUrl,
        collectionVideoUrl: videoUrl ?? stop.collectionVideoUrl,
      },
    });

    await this.notifications.send(
      run.buyerId,
      NotificationType.RUN_COLLECTION_PROOF,
      'Your goods have been collected',
      'The driver uploaded proof of collection from the stall.',
      { runId, stopId, photoUrl, videoUrl },
    );

    return { success: true };
  }

  async confirmReceipt(buyerId: string, runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { stops: { select: { id: true, stallId: true, itemAmount: true } }, escrow: true, driver: { select: { userId: true } } },
    });
    if (!run) throw new NotFoundException('Run not found');
    if (run.buyerId !== buyerId) throw new ForbiddenException('Not your run');
    if (run.status !== RunStatus.DELIVERED) throw new BadRequestException('Run has not been delivered yet');

    return this._releaseEscrow(run);
  }

  async cancelRun(buyerId: string, runId: string) {
    const run = await this.prisma.run.findUnique({ where: { id: runId }, include: { stops: { select: { id: true, stallId: true, itemAmount: true } }, escrow: true, driver: { select: { userId: true } } } });
    if (!run) throw new NotFoundException('Run not found');
    if (run.buyerId !== buyerId) throw new ForbiddenException('Not your run');
    if (run.status !== RunStatus.OPEN && run.status !== RunStatus.LOCKED) {
      throw new BadRequestException('Run cannot be cancelled at this stage');
    }

    return this.prisma.$retryTransaction(
      async (tx) => {
        // Re-read status inside the tx to close the TOCTOU window with acceptBid
        const liveRun = await tx.run.findUnique({ where: { id: runId }, select: { status: true } });
        if (!liveRun) throw new NotFoundException('Run not found');
        if (liveRun.status !== RunStatus.OPEN && liveRun.status !== RunStatus.LOCKED) {
          throw new BadRequestException('Run cannot be cancelled at this stage');
        }

        // Refund escrow if locked
        if (liveRun.status === RunStatus.LOCKED && run.escrow && run.mode === DeliveryMode.SAFE_PAY) {
          const wallet = await tx.wallet.findFirst({ where: { userId: buyerId } });
          if (wallet) {
            const held = run.escrow.totalHeld; // Already Prisma.Decimal
            await tx.wallet.update({
              where: { id: wallet.id },
              data: {
                availableBalance: { increment: held },
                lockedBalance: { decrement: held },
              },
            });
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: WalletTransactionType.RUN_ESCROW_RELEASE,
                amount: run.escrow.totalHeld,
                balanceBefore: wallet.availableBalance,
                balanceAfter: wallet.availableBalance.add(run.escrow.totalHeld),
                status: WalletTransactionStatus.COMPLETED,
                description: `Run cancelled — escrow refunded (run ${runId})`,
                referenceId: runId,
                referenceType: 'run',
                completedAt: new Date(),
              },
            });
            await tx.runEscrow.update({
              where: { runId },
              data: { status: EscrowStatus.REFUNDED_TO_BUYER, releasedAt: new Date() },
            });
          }
        }

        if (run.driver?.userId) {
          await this.notifications.send(run.driver.userId, NotificationType.RUN_CANCELLED, 'Run cancelled', 'The buyer cancelled this run.', { runId },);
        }

        return tx.run.update({
          where: { id: runId },
          data: { status: RunStatus.CANCELLED, cancelReason: 'Buyer cancelled' },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Cron: auto-confirm after 24h ─────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoConfirmDeliveredRuns() {
    const cutoff = new Date(Date.now() - AUTO_CONFIRM_HOURS * 60 * 60 * 1000);
    const runs = await this.prisma.run.findMany({
      where: { status: RunStatus.DELIVERED, deliveryTimestamp: { lt: cutoff } },
      include: { stops: { select: { id: true, stallId: true, itemAmount: true } }, escrow: true, driver: { select: { userId: true } } },
    });
    for (const run of runs) {
      try {
        await this._releaseEscrow(run as any);
        this.logger.log(`Auto-confirmed run ${run.id}`);
      } catch (err) {
        this.logger.error(`Auto-confirm failed for run ${run.id}:`, err);
      }
    }
  }

  // ─── Internal: escrow release ──────────────────────────────────────────────

  private async _releaseEscrow(run: {
    id: string; buyerId: string; driverId: string | null; driverEarning: Prisma.Decimal | null;
    mode: DeliveryMode;
    stops: { stallId: string; itemAmount: Prisma.Decimal }[];
    escrow: { totalHeld: Prisma.Decimal; itemAmount: Prisma.Decimal; deliveryFee: Prisma.Decimal; platformFee: Prisma.Decimal } | null;
    driver: { userId: string } | null;
  }) {
    return this.prisma.$retryTransaction(
      async (tx) => {
        const now = new Date();

        // ── Idempotency guards (re-read inside Serializable tx) ─────────────────
        // Prevents double-release when buyer manual confirm and auto-confirm cron race.
        const liveRunStatus = await tx.run.findUnique({ where: { id: run.id }, select: { status: true } });
        if (liveRunStatus?.status === RunStatus.COMPLETED) return liveRunStatus;

        const liveEscrow = run.escrow
          ? await tx.runEscrow.findUnique({ where: { runId: run.id } })
          : null;

        if (run.mode === DeliveryMode.SAFE_PAY && liveEscrow) {
          if (liveEscrow.status !== EscrowStatus.HELD) {
            // A concurrent tx already released — just mark run completed
            return tx.run.update({ where: { id: run.id }, data: { status: RunStatus.COMPLETED, completedAt: now } });
          }

          // ── Buyer locked-balance debit (audit record) ──────────────────────
          const buyerWallet = await tx.wallet.findFirst({ where: { userId: run.buyerId } });
          if (buyerWallet) {
            const held = liveEscrow.totalHeld;
            await tx.wallet.update({
              where: { id: buyerWallet.id },
              data: { lockedBalance: { decrement: held } },
            });
            await tx.walletTransaction.create({
              data: {
                walletId: buyerWallet.id,
                type: WalletTransactionType.RUN_ESCROW_RELEASE,
                amount: held,
                balanceBefore: buyerWallet.lockedBalance,
                balanceAfter: Prisma.Decimal.max(new Prisma.Decimal(0), buyerWallet.lockedBalance.sub(held)),
                status: WalletTransactionStatus.COMPLETED,
                description: `Run escrow disbursed — payment released (run ${run.id})`,
                referenceId: run.id,
                referenceType: 'run',
                completedAt: now,
              },
            });
          }

          // ── Batch-load all seller merchants + wallets (eliminates N+1 per stop)
          const stopStallIds = run.stops.map((s) => s.stallId);
          const stallMerchants = await tx.merchant.findMany({
            where: { stalls: { some: { id: { in: stopStallIds } } } },
            select: { userId: true, stalls: { where: { id: { in: stopStallIds } }, select: { id: true } } },
          });
          const stallToMerchantUserId = new Map<string, string>();
          for (const m of stallMerchants) {
            for (const s of m.stalls) stallToMerchantUserId.set(s.id, m.userId);
          }
          const sellerUserIds = [...new Set(stallMerchants.map((m) => m.userId))];
          const sellerWallets = await tx.wallet.findMany({ where: { userId: { in: sellerUserIds } } });
          const walletByUserId = new Map(sellerWallets.map((w) => [w.userId, w]));

          // ── Credit each seller their item-amount share ─────────────────────
          for (const stop of run.stops) {
            const merchantUserId = stallToMerchantUserId.get(stop.stallId);
            if (!merchantUserId) continue;
            const sellerWallet = walletByUserId.get(merchantUserId);
            if (!sellerWallet) continue;
            const amt = stop.itemAmount;
            await tx.wallet.update({
              where: { id: sellerWallet.id },
              data: { availableBalance: { increment: amt } },
            });
            await tx.walletTransaction.create({
              data: {
                walletId: sellerWallet.id,
                type: WalletTransactionType.RUN_ESCROW_RELEASE,
                amount: amt,
                balanceBefore: sellerWallet.availableBalance,
                balanceAfter: sellerWallet.availableBalance.add(amt),
                status: WalletTransactionStatus.COMPLETED,
                description: `Run delivery — items sold (run ${run.id})`,
                referenceId: run.id,
                referenceType: 'run',
                completedAt: now,
              },
            });
          }

          // ── Credit driver their earning ────────────────────────────────────
          if (run.driver && run.driverEarning) {
            const driverUser = await tx.driver.findFirst({ where: { userId: run.driver.userId }, select: { id: true } });
            const driverWallet = await tx.wallet.findFirst({ where: { userId: run.driver.userId } });
            if (driverWallet) {
              const earn = run.driverEarning;
              await tx.wallet.update({
                where: { id: driverWallet.id },
                data: { availableBalance: { increment: earn } },
              });
              await tx.walletTransaction.create({
                data: {
                  walletId: driverWallet.id,
                  type: WalletTransactionType.RUN_DRIVER_EARNING,
                  amount: earn,
                  balanceBefore: driverWallet.availableBalance,
                  balanceAfter: driverWallet.availableBalance.add(earn),
                  status: WalletTransactionStatus.COMPLETED,
                  description: `Run delivery earning (run ${run.id})`,
                  referenceId: run.id,
                  referenceType: 'run',
                  completedAt: now,
                },
              });
              if (driverUser) {
                await tx.driver.update({
                  where: { id: driverUser.id },
                  data: { totalEarnings: { increment: earn }, completedJobs: { increment: 1 } },
                });
              }
            }
          }

          // ── Credit platform fee (if platform wallet is configured) ─────────
          if (liveEscrow.platformFee.gt(0)) {
            const platformSetting = await tx.appSetting.findUnique({ where: { key: 'platform_wallet_user_id' } });
            if (platformSetting?.value) {
              const platformWallet = await tx.wallet.findFirst({ where: { userId: platformSetting.value } });
              if (platformWallet) {
                await tx.wallet.update({
                  where: { id: platformWallet.id },
                  data: { availableBalance: { increment: liveEscrow.platformFee } },
                });
                await tx.walletTransaction.create({
                  data: {
                    walletId: platformWallet.id,
                    type: WalletTransactionType.FEE,
                    amount: liveEscrow.platformFee,
                    balanceBefore: platformWallet.availableBalance,
                    balanceAfter: platformWallet.availableBalance.add(liveEscrow.platformFee),
                    status: WalletTransactionStatus.COMPLETED,
                    description: `Platform delivery fee — run ${run.id}`,
                    referenceId: run.id,
                    referenceType: 'run',
                    completedAt: now,
                  },
                });
              } else {
                this.logger.warn(`platform_wallet_user_id "${platformSetting.value}" wallet not found — run ${run.id} platform fee $${liveEscrow.platformFee} uncredited`);
              }
            }
          }

          await tx.runEscrow.update({
            where: { runId: run.id },
            data: { status: EscrowStatus.RELEASED_TO_SELLER, releasedAt: now },
          });
        }

        const completed = await tx.run.update({
          where: { id: run.id },
          data: { status: RunStatus.COMPLETED, completedAt: now },
        });

        if (run.driver?.userId) {
          await this.notifications.send(run.driver.userId, NotificationType.RUN_COMPLETED, 'Run completed — earnings released', `Your earnings for run ${run.id} have been released to your wallet.`, { runId: run.id });
        }

        return completed;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
