import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { DemandStatus, DemandUrgency, OfferStatus, WalletTransactionType, WalletTransactionStatus, WalletLockReason, WalletLockStatus, Prisma } from '@prisma/client';

const BUYER_FEE_RATE = 0.025; // 2.5% platform fee charged to buyer on purchase
const BID_LOCK_HOURS = 1;     // BID lock released after 1 hour if demand not matched

@Injectable()
export class DemandsService {
  private readonly logger = new Logger(DemandsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a buyer demand and atomically lock 10% of the max budget.
   *
   * ATOMICITY FIX: Previously the demand was created first, then the wallet lock
   * was run as a separate operation. If the lock failed, an orphaned demand remained
   * in OPEN state with no locked funds. Now both operations happen in one
   * RepeatableRead transaction — either both succeed or neither does.
   */
  async createDemand(buyerId: string, data: {
    title: string;
    description?: string;
    categoryId?: string;
    preferredSize?: string;
    preferredColor?: string;
    preferredBrand?: string;
    minBudget?: number;
    maxBudget: number;
    urgency?: DemandUrgency;
    mallId?: string;
    expiresInHours?: number;
  }) {
    const lockAmountDec = new Prisma.Decimal(data.maxBudget).mul('0.10');

    return this.prisma.$retryTransaction(
      async (tx) => {
        // --- Wallet checks (inside tx so reads are stable at RepeatableRead) ---
        const wallet = await tx.wallet.findUnique({ where: { userId: buyerId } });
        if (!wallet || wallet.availableBalance.lte(0)) {
          throw new BadRequestException('You must fund your wallet to post demand requests');
        }

        if (wallet.availableBalance.lessThan(lockAmountDec)) {
          throw new BadRequestException(
            `Need $${lockAmountDec.toFixed(2)} (10% of $${data.maxBudget}) in wallet. Available: $${wallet.availableBalance.toFixed(2)}`,
          );
        }

        // --- Create the demand ---
        const expiresAt = new Date(Date.now() + (data.expiresInHours || 72) * 60 * 60 * 1000);

        const demand = await tx.buyerDemand.create({
          data: {
            buyerId,
            title: data.title,
            description: data.description,
            categoryId: data.categoryId,
            preferredSize: data.preferredSize,
            preferredColor: data.preferredColor,
            preferredBrand: data.preferredBrand,
            minBudget: data.minBudget,
            maxBudget: data.maxBudget,
            currency: 'USD',
            urgency: data.urgency || DemandUrgency.MEDIUM,
            status: DemandStatus.OPEN,
            mallId: data.mallId,
            expiresAt,
          },
        });

        // --- Lock 10% of max budget (inline using tx — atomic with demand creation) ---
        const newAvailable = wallet.availableBalance.sub(lockAmountDec);
        const newLocked = wallet.lockedBalance.add(lockAmountDec);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: newAvailable, lockedBalance: newLocked, lastActivityAt: new Date() },
        });

        await tx.walletLock.create({
          data: {
            walletId: wallet.id,
            amount: lockAmountDec,
            reason: WalletLockReason.BID,
            status: WalletLockStatus.ACTIVE,
            referenceId: demand.id,
            referenceType: 'buyer_demand',
            expiresAt: new Date(Date.now() + BID_LOCK_HOURS * 60 * 60 * 1000), // 1 hour
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.BID_LOCK,
            amount: lockAmountDec,
            balanceBefore: wallet.availableBalance,
            balanceAfter: newAvailable,
            status: WalletTransactionStatus.COMPLETED,
            description: `Bid lock for demand ${demand.id}`,
            referenceId: demand.id,
            referenceType: 'wallet_lock',
            completedAt: new Date(),
          },
        });

        return demand;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getOpenDemands(params: {
    categoryId?: string;
    mallId?: string;
    urgency?: DemandUrgency;
    page?: number;
    limit?: number;
  }) {
    const { categoryId, mallId, urgency, page = 1, limit = 20 } = params;
    const where: any = {
      status: DemandStatus.OPEN,
      expiresAt: { gt: new Date() },
    };
    if (categoryId) where.categoryId = categoryId;
    if (mallId) where.mallId = mallId;
    if (urgency) where.urgency = urgency;

    const [data, total] = await Promise.all([
      this.prisma.buyerDemand.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          buyer: { select: { id: true, firstName: true } },
          offers: { where: { status: OfferStatus.PENDING }, select: { id: true } },
        },
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.buyerDemand.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDemandById(id: string) {
    const demand = await this.prisma.buyerDemand.findUnique({
      where: { id },
      include: {
        buyer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        offers: {
          include: {
            stall: {
              select: {
                id: true, name: true, stallNumber: true, latitude: true, longitude: true,
                mall: { select: { name: true, city: true, address: true, latitude: true, longitude: true } },
              },
            },
            chatRoom: { select: { id: true } },
            deliveryRequest: { select: { id: true, status: true, deliveryFee: true, distanceKm: true } },
            items: { include: { variant: { include: { product: { select: { name: true } } } } } },
          },
          orderBy: { totalPrice: 'asc' },
        },
      },
    });
    if (!demand) throw new NotFoundException('Demand not found');
    return demand;
  }

  async getDeliveryRate() {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: 'delivery_rate_per_km' } });
    return { ratePerKm: parseFloat(setting?.value ?? '0.50') };
  }

  async requestDelivery(offerId: string, buyerId: string, data: {
    buyerLat: number;
    buyerLng: number;
    buyerAddress?: string;
  }) {
    // Validate coordinates before any DB work
    if (!Number.isFinite(data.buyerLat) || Math.abs(data.buyerLat) > 90)
      throw new BadRequestException('Invalid latitude');
    if (!Number.isFinite(data.buyerLng) || Math.abs(data.buyerLng) > 180)
      throw new BadRequestException('Invalid longitude');
    const offer = await this.prisma.sellerOffer.findUnique({
      where: { id: offerId },
      include: {
        demand: { select: { buyerId: true } },
        stall: { select: { latitude: true, longitude: true, mall: { select: { latitude: true, longitude: true } } } },
        deliveryRequest: true,
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.demand.buyerId !== buyerId) throw new ForbiddenException('Not your offer');
    if (offer.status !== 'ACCEPTED') throw new BadRequestException('Offer must be accepted before requesting delivery');
    if (offer.deliveryRequest) throw new BadRequestException('Delivery already requested');

    const stallLat = offer.stall.latitude ?? offer.stall.mall?.latitude;
    const stallLng = offer.stall.longitude ?? offer.stall.mall?.longitude;
    if (stallLat == null || stallLng == null) throw new BadRequestException('Stall location not available for delivery');

    const rateSetting = await this.prisma.appSetting.findUnique({ where: { key: 'delivery_rate_per_km' } });
    const ratePerKm = parseFloat(rateSetting?.value ?? '0.50');

    const distanceKm = this.haversine(data.buyerLat, data.buyerLng, stallLat, stallLng);
    const feeAmount = Math.ceil(distanceKm * ratePerKm * 100) / 100;
    const feeDec = new Prisma.Decimal(feeAmount.toFixed(2));

    const wallet = await this.prisma.wallet.findUnique({ where: { userId: buyerId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.availableBalance.lessThan(feeDec)) {
      throw new BadRequestException(
        `Insufficient balance for delivery fee of $${feeDec.toFixed(2)}. Available: $${wallet.availableBalance.toFixed(2)}`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryRequest.create({
        data: {
          offerId,
          buyerLat: data.buyerLat,
          buyerLng: data.buyerLng,
          buyerAddress: data.buyerAddress,
          distanceKm,
          deliveryFee: feeDec,
          status: 'PENDING',
        },
      });
      const newBalance = wallet.availableBalance.sub(feeDec);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: newBalance, lastActivityAt: new Date() },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.FEE,
          amount: feeDec,
          balanceBefore: wallet.availableBalance,
          balanceAfter: newBalance,
          status: WalletTransactionStatus.COMPLETED,
          description: `Delivery fee for offer ${offerId} (${distanceKm.toFixed(1)}km × $${ratePerKm}/km)`,
          referenceId: offerId,
          referenceType: 'delivery_request',
          completedAt: new Date(),
        },
      });
    });

    return { distanceKm, deliveryFee: feeAmount, status: 'PENDING' };
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number) { return deg * (Math.PI / 180); }

  /**
   * ATOMICITY FIX: demand status check and offer creation are now in one
   * RepeatableRead transaction. Previously the check happened outside any
   * transaction — a concurrent acceptOffer could match the demand between
   * the check and the create, leaving an orphaned PENDING offer on a MATCHED demand.
   */
  async submitOffer(stallId: string, demandId: string, data: {
    message?: string;
    totalPrice: number;
    items: Array<{ variantId: string; quantity: number; price: number }>;
    expiresInHours?: number;
  }) {
    return this.prisma.$retryTransaction(
      async (tx) => {
        const demand = await tx.buyerDemand.findUnique({ where: { id: demandId } });
        if (!demand) throw new NotFoundException('Demand not found');
        if (demand.status !== DemandStatus.OPEN) throw new BadRequestException('Demand is no longer open');
        if (!Number.isFinite(data.totalPrice) || data.totalPrice <= 0)
          throw new BadRequestException('Offer price must be a positive number');

        return tx.sellerOffer.create({
          data: {
            demandId,
            stallId,
            message: data.message,
            totalPrice: data.totalPrice,
            currency: 'USD',
            status: OfferStatus.PENDING,
            expiresAt: new Date(Date.now() + (data.expiresInHours || 48) * 60 * 60 * 1000),
            items: {
              create: data.items.map(item => ({
                variantId: item.variantId,
                quantity: item.quantity,
                price: item.price,
              })),
            },
          },
          include: { items: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async acceptOffer(buyerId: string, offerId: string) {
    return this.prisma.$retryTransaction(
      async (tx) => {
        const now = new Date();

        // All checks inside the Serializable tx to prevent TOCTOU race
        const offer = await tx.sellerOffer.findUnique({
          where: { id: offerId },
          include: { demand: true },
        });
        if (!offer) throw new NotFoundException('Offer not found');
        if (offer.demand.buyerId !== buyerId) throw new ForbiddenException('Not your demand');
        if (offer.status !== OfferStatus.PENDING) throw new BadRequestException('Offer is no longer pending');
        if (offer.demand.status !== DemandStatus.OPEN) throw new BadRequestException('Demand is no longer open');

        // Release the buyer's BID lock — demand is matched, funds no longer need to be held
        const buyerWallet = await tx.wallet.findUnique({ where: { userId: buyerId } });
        if (buyerWallet) {
          const bidLock = await tx.walletLock.findFirst({
            where: { walletId: buyerWallet.id, referenceId: offer.demandId, status: WalletLockStatus.ACTIVE },
          });
          if (bidLock) {
            const newAvailable = buyerWallet.availableBalance.add(bidLock.amount);
            const newLocked = Prisma.Decimal.max(new Prisma.Decimal(0), buyerWallet.lockedBalance.sub(bidLock.amount));

            await tx.walletLock.update({
              where: { id: bidLock.id },
              data: { status: WalletLockStatus.RELEASED, releasedAt: now },
            });

            await tx.wallet.update({
              where: { id: buyerWallet.id },
              data: { availableBalance: newAvailable, lockedBalance: newLocked, lastActivityAt: now },
            });

            await tx.walletTransaction.create({
              data: {
                walletId: buyerWallet.id,
                type: WalletTransactionType.BID_UNLOCK,
                amount: bidLock.amount,
                balanceBefore: buyerWallet.availableBalance,
                balanceAfter: newAvailable,
                status: WalletTransactionStatus.COMPLETED,
                description: `Bid lock released — demand matched (offer ${offerId})`,
                referenceId: offer.demandId,
                referenceType: 'buyer_demand',
                completedAt: now,
              },
            });
          }
        }

        // Deduct 2.5% platform fee from buyer wallet on purchase
        const offerPrice = new Prisma.Decimal((offer.totalPrice as any).toString());
        const feeDec = offerPrice.mul(BUYER_FEE_RATE.toString());
        const buyerWalletFresh = await tx.wallet.findUnique({ where: { userId: buyerId } });
        if (!buyerWalletFresh) throw new NotFoundException('Buyer wallet not found');

        if (buyerWalletFresh.availableBalance.lessThan(feeDec)) {
          throw new BadRequestException(
            `Insufficient wallet balance for platform fee. ` +
            `Fee: $${feeDec.toFixed(2)} (2.5% of $${offerPrice.toFixed(2)}). ` +
            `Available: $${buyerWalletFresh.availableBalance.toFixed(2)}. Please fund your wallet.`,
          );
        }

        const buyerNewBalance = buyerWalletFresh.availableBalance.sub(feeDec);
        await tx.wallet.update({
          where: { id: buyerWalletFresh.id },
          data: { availableBalance: buyerNewBalance, lastActivityAt: now },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: buyerWalletFresh.id,
            type: WalletTransactionType.COMMISSION_DEDUCTION,
            amount: feeDec,
            balanceBefore: buyerWalletFresh.availableBalance,
            balanceAfter: buyerNewBalance,
            status: WalletTransactionStatus.COMPLETED,
            description: `Platform fee (2.5%) for accepted offer ${offerId}`,
            referenceId: offerId,
            referenceType: 'seller_offer',
            completedAt: now,
          },
        });

        // Accept this offer
        await tx.sellerOffer.update({
          where: { id: offerId },
          data: { status: OfferStatus.ACCEPTED, respondedAt: now },
        });

        // Reject all other pending offers
        await tx.sellerOffer.updateMany({
          where: { demandId: offer.demandId, id: { not: offerId }, status: OfferStatus.PENDING },
          data: { status: OfferStatus.REJECTED, respondedAt: now },
        });

        // Close the demand
        await tx.buyerDemand.update({
          where: { id: offer.demandId },
          data: { status: DemandStatus.MATCHED },
        });

        return { accepted: true, offerId, feeCharged: feeDec.toNumber() };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getMyDemands(buyerId: string, status?: DemandStatus) {
    const where: any = { buyerId };
    if (status) where.status = status;
    return this.prisma.buyerDemand.findMany({
      where,
      include: { offers: { select: { id: true, totalPrice: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOffersForStall(stallId: string) {
    return this.prisma.sellerOffer.findMany({
      where: { stallId },
      include: {
        demand: { select: { title: true, maxBudget: true, urgency: true, buyer: { select: { firstName: true } } } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Runs every 5 minutes. Finds all expired BID locks and atomically:
   * 1. Returns locked funds to buyer's availableBalance
   * 2. Marks the WalletLock as RELEASED
   * 3. Records a BID_UNLOCK wallet transaction
   * 4. Marks the demand as EXPIRED if still OPEN
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredBidLocks() {
    const expiredLocks = await this.prisma.walletLock.findMany({
      where: {
        status: WalletLockStatus.ACTIVE,
        reason: WalletLockReason.BID,
        expiresAt: { lt: new Date() },
      },
      include: { wallet: true },
    });

    if (expiredLocks.length === 0) return;

    this.logger.log(`Releasing ${expiredLocks.length} expired BID lock(s)`);

    for (const lock of expiredLocks) {
      try {
        await this.prisma.$retryTransaction(
          async (tx) => {
            const now = new Date();
            const wallet = await tx.wallet.findUnique({ where: { id: lock.walletId } });
            if (!wallet) return;

            const newAvailable = wallet.availableBalance.add(lock.amount);
            const newLocked = Prisma.Decimal.max(new Prisma.Decimal(0), wallet.lockedBalance.sub(lock.amount));

            await tx.walletLock.update({
              where: { id: lock.id },
              data: { status: WalletLockStatus.RELEASED, releasedAt: now },
            });

            await tx.wallet.update({
              where: { id: wallet.id },
              data: { availableBalance: newAvailable, lockedBalance: newLocked, lastActivityAt: now },
            });

            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: WalletTransactionType.BID_UNLOCK,
                amount: lock.amount,
                balanceBefore: wallet.availableBalance,
                balanceAfter: newAvailable,
                status: WalletTransactionStatus.COMPLETED,
                description: `BID lock expired — funds returned (demand ${lock.referenceId})`,
                referenceId: lock.referenceId,
                referenceType: 'buyer_demand',
                completedAt: now,
              },
            });

            // Mark the demand as EXPIRED if still OPEN
            if (lock.referenceId) {
              await tx.buyerDemand.updateMany({
                where: { id: lock.referenceId, status: DemandStatus.OPEN },
                data: { status: DemandStatus.EXPIRED },
              });
            }
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        );
      } catch (err) {
        this.logger.error(`Failed to release BID lock ${lock.id}:`, err);
      }
    }
  }
}
