import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DemandStatus, DemandUrgency, OfferStatus, WalletTransactionType, WalletTransactionStatus, WalletLockReason, WalletLockStatus, Prisma } from '@prisma/client';

@Injectable()
export class DemandsService {
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
    const lockAmount = data.maxBudget * 0.10;

    return this.prisma.$retryTransaction(
      async (tx) => {
        // --- Wallet checks (inside tx so reads are stable at RepeatableRead) ---
        const wallet = await tx.wallet.findUnique({ where: { userId: buyerId } });
        if (!wallet || parseFloat(wallet.availableBalance.toString()) <= 0) {
          throw new BadRequestException('You must fund your wallet to post demand requests');
        }

        const available = parseFloat(wallet.availableBalance.toString());
        if (available < lockAmount) {
          throw new BadRequestException(
            `Need $${lockAmount.toFixed(2)} (10% of $${data.maxBudget}) in wallet. Available: $${available.toFixed(2)}`,
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
        const newAvailable = new Prisma.Decimal(available - lockAmount);
        const newLocked = new Prisma.Decimal(parseFloat(wallet.lockedBalance.toString()) + lockAmount);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: newAvailable, lockedBalance: newLocked, lastActivityAt: new Date() },
        });

        await tx.walletLock.create({
          data: {
            walletId: wallet.id,
            amount: new Prisma.Decimal(lockAmount),
            reason: WalletLockReason.BID,
            status: WalletLockStatus.ACTIVE,
            referenceId: demand.id,
            referenceType: 'buyer_demand',
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.BID_LOCK,
            amount: new Prisma.Decimal(lockAmount),
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
        buyer: { select: { id: true, firstName: true, lastName: true } },
        offers: {
          include: {
            items: { include: { variant: { include: { product: { select: { name: true } } } } } },
          },
          orderBy: { totalPrice: 'asc' },
        },
      },
    });
    if (!demand) throw new NotFoundException('Demand not found');
    return demand;
  }

  async submitOffer(stallId: string, demandId: string, data: {
    message?: string;
    totalPrice: number;
    items: Array<{ variantId: string; quantity: number; price: number }>;
    expiresInHours?: number;
  }) {
    const demand = await this.prisma.buyerDemand.findUnique({ where: { id: demandId } });
    if (!demand) throw new NotFoundException('Demand not found');
    if (demand.status !== DemandStatus.OPEN) throw new BadRequestException('Demand is no longer open');

    return this.prisma.sellerOffer.create({
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
  }

  async acceptOffer(buyerId: string, offerId: string) {
    const offer = await this.prisma.sellerOffer.findUnique({
      where: { id: offerId },
      include: { demand: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.demand.buyerId !== buyerId) throw new ForbiddenException('Not your demand');
    if (offer.status !== OfferStatus.PENDING) throw new BadRequestException('Offer is no longer pending');

    return this.prisma.$retryTransaction(
      async (tx) => {
        const offerPrice = parseFloat(offer.totalPrice.toString());

        // --- Buyer wallet ---
        const buyerWallet = await tx.wallet.findUnique({ where: { userId: buyerId } });
        if (!buyerWallet) throw new BadRequestException('Buyer wallet not found');

        // Find the active BID lock for this demand
        const bidLock = await tx.walletLock.findFirst({
          where: { walletId: buyerWallet.id, referenceId: offer.demandId, status: WalletLockStatus.ACTIVE },
        });
        const lockAmount = bidLock ? parseFloat(bidLock.amount.toString()) : 0;

        // After releasing lock, buyer needs enough for full offer price
        const buyerAvailable = parseFloat(buyerWallet.availableBalance.toString());
        const buyerLocked = parseFloat(buyerWallet.lockedBalance.toString());
        const availableAfterLockRelease = buyerAvailable + lockAmount;

        if (availableAfterLockRelease < offerPrice) {
          throw new BadRequestException(
            `Insufficient balance. Need $${offerPrice.toFixed(2)}, have $${availableAfterLockRelease.toFixed(2)} after releasing bid lock`,
          );
        }

        // --- Seller wallet (stall -> merchant -> user -> wallet) ---
        const stall = await tx.stall.findUnique({ where: { id: offer.stallId }, include: { merchant: true } });
        if (!stall?.merchant) throw new BadRequestException('Seller stall or merchant not found');
        const sellerWallet = await tx.wallet.findUnique({ where: { userId: stall.merchant.userId } });
        if (!sellerWallet) throw new BadRequestException('Seller wallet not found');

        const now = new Date();

        // Release bid lock
        if (bidLock) {
          await tx.walletLock.update({
            where: { id: bidLock.id },
            data: { status: WalletLockStatus.CONVERTED, releasedAt: now },
          });
        }

        // Debit buyer full offer price (lock is released first, then full amount deducted)
        const buyerNewAvailable = new Prisma.Decimal(availableAfterLockRelease - offerPrice);
        const buyerNewLocked = new Prisma.Decimal(Math.max(0, buyerLocked - lockAmount));

        await tx.wallet.update({
          where: { id: buyerWallet.id },
          data: { availableBalance: buyerNewAvailable, lockedBalance: buyerNewLocked, lastActivityAt: now },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: buyerWallet.id,
            type: WalletTransactionType.PURCHASE_DEBIT,
            amount: new Prisma.Decimal(offerPrice),
            balanceBefore: buyerWallet.availableBalance,
            balanceAfter: buyerNewAvailable,
            status: WalletTransactionStatus.COMPLETED,
            description: `Payment for demand offer ${offerId}`,
            referenceId: offerId,
            referenceType: 'seller_offer',
            counterpartyId: sellerWallet.userId,
            completedAt: now,
          },
        });

        // Credit seller
        const sellerAvailable = parseFloat(sellerWallet.availableBalance.toString());
        const sellerNewAvailable = new Prisma.Decimal(sellerAvailable + offerPrice);

        await tx.wallet.update({
          where: { id: sellerWallet.id },
          data: { availableBalance: sellerNewAvailable, lastActivityAt: now },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: sellerWallet.id,
            type: WalletTransactionType.SALE_CREDIT,
            amount: new Prisma.Decimal(offerPrice),
            balanceBefore: sellerWallet.availableBalance,
            balanceAfter: sellerNewAvailable,
            status: WalletTransactionStatus.COMPLETED,
            description: `Sale credit for demand offer ${offerId}`,
            referenceId: offerId,
            referenceType: 'seller_offer',
            counterpartyId: buyerWallet.userId,
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

        return { accepted: true, offerId, amountPaid: offerPrice };
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
}
