import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, RunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface CreatePickupPointDto {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdatePickupPointDto {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

function generateCollectionCode(pickupPointName: string): string {
  const prefix = pickupPointName
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${digits}`;
}

@Injectable()
export class PickupPointsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreatePickupPointDto) {
    return this.prisma.pickupPoint.create({ data: dto });
  }

  async list(activeOnly = true) {
    return this.prisma.pickupPoint.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async getById(id: string) {
    const pp = await this.prisma.pickupPoint.findUnique({ where: { id } });
    if (!pp) throw new NotFoundException('Pickup point not found');
    return pp;
  }

  async update(id: string, dto: UpdatePickupPointDto) {
    await this.getById(id);
    return this.prisma.pickupPoint.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.getById(id);
    return this.prisma.pickupPoint.update({ where: { id }, data: { isActive: false } });
  }

  /** Called when driver has deposited the run at the pickup point. */
  async markDeliveredToPickupPoint(driverId: string, runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { pickupPoint: true },
    });
    if (!run) throw new NotFoundException('Run not found');
    if (!run.pickupPointId || !run.pickupPoint) throw new BadRequestException('Run is not a pickup point run');
    if (run.driverId !== driverId) throw new BadRequestException('Not your run');
    if (run.status !== RunStatus.IN_PROGRESS) throw new BadRequestException('Run must be IN_PROGRESS to mark as delivered to pickup point');

    await this.prisma.run.update({
      where: { id: runId },
      data: { status: RunStatus.AT_PICKUP_POINT },
    });

    await this.notifications.send(
      run.buyerId,
      NotificationType.RUN_READY_FOR_COLLECTION,
      'Your order is ready for collection',
      `Your order is at ${run.pickupPoint.name}. Present your collection code ${run.collectionCode} when you arrive.`,
      { runId, pickupPointName: run.pickupPoint.name, collectionCode: run.collectionCode },
    );

    return { success: true, collectionCode: run.collectionCode, pickupPoint: run.pickupPoint.name };
  }

  /** Pickup point operator scans the customer's QR token to hand over the goods. */
  async scanCollectionToken(scannerId: string, token: string) {
    const run = await this.prisma.run.findFirst({
      where: { collectionToken: token },
      include: {
        pickupPoint: true,
        stops: {
          include: {
            stall: { select: { name: true } },
            items: {
              include: {
                variant: {
                  select: { name: true, product: { select: { name: true } } },
                },
              },
            },
          },
        },
        escrow: true,
        driver: { select: { userId: true } },
      },
    });

    if (!run) throw new NotFoundException('Invalid collection code');
    if (run.status !== RunStatus.AT_PICKUP_POINT) {
      throw new BadRequestException('Order is not ready for collection yet');
    }
    if (run.collectedAt) throw new BadRequestException('Order has already been collected');

    const now = new Date();
    await this.prisma.run.update({
      where: { id: run.id },
      data: {
        status: RunStatus.COLLECTED,
        collectedAt: now,
        collectedById: scannerId,
        completedAt: now,
      },
    });

    // Release escrow — same logic as confirmReceipt
    if (run.escrow && run.mode === 'SAFE_PAY') {
      await this._releaseEscrowForPickup(run as any);
    }

    await this.notifications.send(
      run.buyerId,
      NotificationType.RUN_COLLECTED,
      'Order collected',
      `Your order has been collected from ${run.pickupPoint?.name ?? 'the pickup point'}.`,
      { runId: run.id },
    );

    return {
      collected: true,
      runId: run.id,
      buyerName: null,
      collectionCode: run.collectionCode,
      pickupPoint: run.pickupPoint?.name,
      stops: run.stops.map((s) => ({
        stall: s.stall.name,
        items: s.items.map((i) => ({
          product: i.variant.product.name,
          variant: i.variant.name,
          quantity: i.quantity,
        })),
      })),
    };
  }

  private async _releaseEscrowForPickup(run: any) {
    const { Prisma, WalletTransactionType, WalletTransactionStatus, EscrowStatus } = await import('@prisma/client');

    const zero = new Prisma.Decimal(0);
    const agreedFee: typeof zero = run.agreedFee ? new Prisma.Decimal(String(run.agreedFee)) : zero;
    const driverEarning: typeof zero = run.driverEarning ? new Prisma.Decimal(String(run.driverEarning)) : agreedFee;
    const itemAmount: typeof zero = run.escrow?.itemAmount ? new Prisma.Decimal(String(run.escrow.itemAmount)) : zero;
    const totalHeld: typeof zero = run.escrow?.totalHeld ? new Prisma.Decimal(String(run.escrow.totalHeld)) : zero;

    await this.prisma.$transaction(async (tx) => {
      // Move buyer's locked funds to available (release from locked)
      const buyerWallet = await tx.wallet.findFirst({ where: { userId: run.buyerId } });
      if (buyerWallet && totalHeld.greaterThan(0)) {
        await tx.wallet.update({
          where: { id: buyerWallet.id },
          data: { lockedBalance: { decrement: totalHeld } },
        });
      }

      // Credit item amounts to each stall merchant wallet
      for (const stop of run.stops ?? []) {
        const stall = await tx.stall.findUnique({ where: { id: stop.stallId }, include: { merchant: { include: { user: { include: { wallet: true } } } } } });
        if (stall?.merchant?.user?.wallet) {
          const amt = new Prisma.Decimal(String(stop.itemAmount));
          const w = stall.merchant.user.wallet;
          await tx.wallet.update({
            where: { id: w.id },
            data: { availableBalance: { increment: amt } },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: w.id,
              type: WalletTransactionType.SALE_CREDIT,
              amount: amt,
              balanceBefore: w.availableBalance,
              balanceAfter: w.availableBalance.add(amt),
              status: WalletTransactionStatus.COMPLETED,
              description: `Run ${run.id} — goods sold (pickup collection)`,
              referenceId: run.id,
              referenceType: 'run',
              completedAt: new Date(),
            },
          });
        }
      }

      // Credit driver earning
      if (run.driver?.userId && driverEarning.greaterThan(0)) {
        const driverWallet = await tx.wallet.findFirst({ where: { userId: run.driver.userId } });
        if (driverWallet) {
          const earn = new Prisma.Decimal(driverEarning);
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
              description: `Run ${run.id} driver earning (pickup collection)`,
              referenceId: run.id,
              referenceType: 'run',
              completedAt: new Date(),
            },
          });
        }
      }

      // Mark escrow released
      if (run.escrow) {
        await tx.runEscrow.update({
          where: { id: run.escrow.id },
          data: { status: EscrowStatus.RELEASED_TO_SELLER, releasedAt: new Date() },
        });
      }
    });
  }

  /** Generate a fresh collection token and code for a run (called from runs service). */
  generateTokenAndCode(pickupPointName: string): { collectionToken: string; collectionCode: string } {
    return {
      collectionToken: randomUUID(),
      collectionCode: generateCollectionCode(pickupPointName),
    };
  }
}
