import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { resolveStoreLogo } from '../../common/utils/store-branding';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DemandStatus,
  DemandUrgency,
  NotificationType,
  OfferStatus,
  WalletTransactionType,
  WalletTransactionStatus,
  WalletLockReason,
  WalletLockStatus,
  Prisma,
  PaymentMethod,
  POSSaleStatus,
  UserRole,
} from '@prisma/client';

/** Minimum available balance (USD) to accept a demand offer — no percentage fee. */
const BUYER_MIN_WALLET_USD = 1;
/** Minimum seller wallet (USD) to record a demand-facilitated sale (no commission on that flow). */
const SELLER_MIN_WALLET_USD = 5;
const BID_LOCK_HOURS = 24; // Default demand expiry when caller does not supply expiresInHours
const BUYER_TRIAL_DAYS = 7;

/**
 * Ops roles: skip buyer/seller wallet minimums for demands (support / QA).
 * - Posting: no 10% bid lock.
 * - Accepting an offer: no $1 minimum for staff.
 * - Completing a demand sale: no $5 seller minimum for staff.
 */
const DEMAND_WALLET_EXEMPT_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_OPS,
  UserRole.FINANCE_ADMIN,
  UserRole.SUPPORT_ADMIN,
  UserRole.MALL_MANAGER,
]);

@Injectable()
export class DemandsService {
  private readonly logger = new Logger(DemandsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a buyer demand.
   * During the first 7 days after signup the 10% wallet lock is waived
   * so new customers can explore the platform at zero cost.
   */
  async createDemand(buyerId: string, data: {
    title: string;
    description?: string;
    categoryId?: string;
    productId?: string;
    stallId?: string;
    preferredSize?: string;
    preferredColor?: string;
    preferredBrand?: string;
    minBudget?: number;
    maxBudget: number;
    urgency?: DemandUrgency;
    mallId?: string;
    deliveryLocation?: string;
    expiresInHours?: number;
  }) {
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerId },
      select: { createdAt: true, role: true },
    });
    const accountAgeDays = buyer ? (Date.now() - buyer.createdAt.getTime()) / 86_400_000 : Infinity;
    const onTrial = accountAgeDays < BUYER_TRIAL_DAYS;
    const skipWalletLock =
      onTrial || (buyer?.role != null && DEMAND_WALLET_EXEMPT_ROLES.has(buyer.role));
    const lockAmountDec = new Prisma.Decimal(data.maxBudget).mul('0.10');

    return this.prisma.$retryTransaction(
      async (tx) => {
        // --- Wallet checks (skipped during trial or for ops staff posting test demands) ---
        let wallet: any = null;
        if (!skipWalletLock) {
          wallet = await tx.wallet.findUnique({ where: { userId: buyerId } });
          if (!wallet || wallet.availableBalance.lte(0)) {
            throw new BadRequestException('You must fund your wallet to post demand requests');
          }

          if (wallet.availableBalance.lessThan(lockAmountDec)) {
            throw new BadRequestException(
              `Need $${lockAmountDec.toFixed(2)} (10% of $${data.maxBudget}) in wallet. Available: $${wallet.availableBalance.toFixed(2)}`,
            );
          }
        }

        // If linked to a product, resolve stall and category from it
        const productId = data.productId || undefined;
        let stallId = data.stallId || undefined;
        let categoryId = data.categoryId || undefined;
        let mallId = data.mallId || undefined;

        if (productId) {
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { stallId: true, categoryId: true, stall: { select: { mallId: true } } },
          });
          if (product) {
            stallId = stallId || product.stallId;
            categoryId = categoryId || product.categoryId || undefined;
            mallId = mallId || product.stall.mallId || undefined;
          }
        }

        // --- Create the demand ---
        const expiresAt = new Date(Date.now() + (data.expiresInHours ?? BID_LOCK_HOURS) * 60 * 60 * 1000);

        const demand = await tx.buyerDemand.create({
          data: {
            buyerId,
            title: data.title,
            description: data.description,
            categoryId,
            productId,
            stallId,
            preferredSize: data.preferredSize,
            preferredColor: data.preferredColor,
            preferredBrand: data.preferredBrand,
            minBudget: data.minBudget,
            maxBudget: data.maxBudget,
            currency: 'USD',
            urgency: data.urgency || DemandUrgency.MEDIUM,
            status: DemandStatus.OPEN,
            mallId,
            deliveryLocation: data.deliveryLocation,
            expiresAt,
          },
        });

        // --- Lock 10% of max budget (skipped when wallet checks skipped) ---
        if (!skipWalletLock && wallet) {
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
            expiresAt: new Date(Date.now() + BID_LOCK_MINUTES * 60 * 1000),
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
        }

        return demand;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getOpenDemands(params: {
    categoryId?: string;
    mallId?: string;
    cityId?: string;
    urgency?: DemandUrgency;
    page?: number;
    limit?: number;
  }) {
    const { categoryId, mallId, cityId, urgency, page = 1, limit = 20 } = params;
    const where: any = {
      status: DemandStatus.OPEN,
      expiresAt: { gt: new Date() },
    };
    if (categoryId) where.categoryId = categoryId;
    if (mallId) where.mallId = mallId;
    if (cityId) where.mall = { cityId };
    if (urgency) where.urgency = urgency;

    const [data, total] = await Promise.all([
      this.prisma.buyerDemand.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          buyer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              trustScore: { select: { overallScore: true } },
            },
          },
          product: { select: { id: true, name: true, minPrice: true, maxPrice: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
          stall: { select: { id: true, name: true } },
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
        buyer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            trustScore: { select: { overallScore: true } },
          },
        },
        product: { select: { id: true, name: true, minPrice: true, maxPrice: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } } },
        stall: { select: { id: true, name: true, stallNumber: true } },
        offers: {
          include: {
            stall: {
              select: {
                id: true, name: true, stallNumber: true, latitude: true, longitude: true,
                merchant: { select: { userId: true } },
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

  /**
   * Price an accepted-offer delivery job the same way as requestDelivery
   * (per-km from settings), for use before creating a {@link DeliveryJob}.
   * When buyer GPS is missing, uses default km from `delivery_default_quote_km` (default 5).
   */
  async quoteOfferDelivery(
    buyerId: string,
    offerId: string,
    buyerGps?: { lat: number; lng: number },
  ) {
    const offer = await this.prisma.sellerOffer.findUnique({
      where: { id: offerId },
      include: {
        demand: { select: { buyerId: true, status: true } },
        stall: { select: { latitude: true, longitude: true, mall: { select: { latitude: true, longitude: true } } } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.demand.buyerId !== buyerId) throw new ForbiddenException('Not your offer');
    if (offer.status !== OfferStatus.ACCEPTED) {
      throw new BadRequestException('Offer must be accepted before arranging delivery');
    }
    if (offer.demand.status !== DemandStatus.MATCHED) {
      throw new BadRequestException('Demand is not in a state for delivery on this offer');
    }

    const stallLat = offer.stall.latitude ?? offer.stall.mall?.latitude;
    const stallLng = offer.stall.longitude ?? offer.stall.mall?.longitude;
    if (stallLat == null || stallLng == null) {
      throw new BadRequestException('Stall location not available for delivery pricing');
    }

    const rateSetting = await this.prisma.appSetting.findUnique({ where: { key: 'delivery_rate_per_km' } });
    const ratePerKm = parseFloat(rateSetting?.value ?? '0.50');
    const defaultKmSetting = await this.prisma.appSetting.findUnique({
      where: { key: 'delivery_default_quote_km' },
    });
    const defaultKm = Math.max(0.5, parseFloat(defaultKmSetting?.value ?? '5'));

    const hasGps =
      buyerGps != null &&
      Number.isFinite(buyerGps.lat) &&
      Number.isFinite(buyerGps.lng) &&
      Math.abs(buyerGps.lat) <= 90 &&
      Math.abs(buyerGps.lng) <= 180;

    const distanceKm = hasGps
      ? this.haversine(buyerGps!.lat, buyerGps!.lng, Number(stallLat), Number(stallLng))
      : defaultKm;
    const feeAmount = Math.ceil(distanceKm * ratePerKm * 100) / 100;
    return {
      distanceKm: Number(distanceKm.toFixed(2)),
      deliveryFee: feeAmount,
      ratePerKm,
      estimateOnly: !hasGps,
      pickupLat: Number(stallLat),
      pickupLng: Number(stallLng),
      dropLat: hasGps ? buyerGps!.lat : null,
      dropLng: hasGps ? buyerGps!.lng : null,
    };
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

    await this.prisma.$retryTransaction(
      async (tx) => {
        const walletFresh = await tx.wallet.findUnique({ where: { userId: buyerId } });
        if (!walletFresh) throw new NotFoundException('Wallet not found');
        if (walletFresh.availableBalance.lessThan(feeDec)) {
          throw new BadRequestException(
            `Insufficient balance for delivery fee of $${feeDec.toFixed(2)}. Available: $${walletFresh.availableBalance.toFixed(2)}`,
          );
        }

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
        const newBalance = walletFresh.availableBalance.sub(feeDec);
        await tx.wallet.update({
          where: { id: walletFresh.id },
          data: { availableBalance: newBalance, lastActivityAt: new Date() },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: walletFresh.id,
            type: WalletTransactionType.FEE,
            amount: feeDec,
            balanceBefore: walletFresh.availableBalance,
            balanceAfter: newBalance,
            status: WalletTransactionStatus.COMPLETED,
            description: `Delivery fee for offer ${offerId} (${distanceKm.toFixed(1)}km × $${ratePerKm}/km)`,
            referenceId: offerId,
            referenceType: 'delivery_request',
            completedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

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
            expiresAt: new Date(Date.now() + BID_LOCK_MINUTES * 60 * 1000),
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

        const buyerUser = await tx.user.findUnique({ where: { id: buyerId }, select: { role: true } });
        const skipBuyerBalanceRules =
          buyerUser?.role != null && DEMAND_WALLET_EXEMPT_ROLES.has(buyerUser.role);

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

        if (!skipBuyerBalanceRules) {
          const buyerWalletFresh = await tx.wallet.findUnique({ where: { userId: buyerId } });
          if (!buyerWalletFresh) throw new NotFoundException('Wallet not found');
          const minBal = new Prisma.Decimal(BUYER_MIN_WALLET_USD);
          if (buyerWalletFresh.availableBalance.lt(minBal)) {
            throw new BadRequestException(
              `You need at least $${BUYER_MIN_WALLET_USD.toFixed(2)} available in your wallet to accept an offer. ` +
                `Current: $${buyerWalletFresh.availableBalance.toFixed(2)}. Please add funds.`,
            );
          }
        }

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

        return { accepted: true, offerId, feeCharged: 0 };
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
   * Seller completes a demand sale after physically meeting the buyer.
   * This atomically:
   *   1. Validates the demand is MATCHED and this stall won
   *   2. Requires seller wallet >= $5 for this feature — no percent commission on demand sales
   *   3. Deducts inventory for any offer items with known variants
   *   4. Creates a full POS sale record with receipt number (0% platform commission on demand-facilitated sales)
   *   5. Marks demand as FULFILLED
   *   6. Notifies the buyer
   */
  async completeDemandSale(demandId: string, stallId: string, cashierId: string, paymentMethod: PaymentMethod) {
    // Load demand + accepted offer + offer items outside tx first
    const demand = await this.prisma.buyerDemand.findUnique({
      where: { id: demandId },
      include: {
        offers: {
          where: { status: OfferStatus.ACCEPTED },
          include: { items: { include: { variant: { include: { inventory: true, product: { select: { name: true } } } } } } },
        },
        buyer: { select: { id: true, firstName: true } },
      },
    });
    if (!demand) throw new NotFoundException('Demand not found');
    if (demand.status !== DemandStatus.MATCHED) {
      throw new BadRequestException('Only a MATCHED demand can be completed');
    }

    const offer = demand.offers[0];
    if (!offer) throw new BadRequestException('No accepted offer found');
    if (offer.stallId !== stallId) {
      throw new ForbiddenException('Only the winning seller can complete this sale');
    }

    return this.prisma.$retryTransaction(async (tx) => {
      const stall = await tx.stall.findUnique({
        where: { id: stallId },
        include: { merchant: { include: { user: true } } },
      });
      if (!stall) throw new NotFoundException('Stall not found');

      const totalAmount = new Prisma.Decimal(offer.totalPrice);
      const commissionRate = new Prisma.Decimal(0);
      const commissionAmount = new Prisma.Decimal(0);

      const sellerUser = stall.merchant.user;
      const skipSellerBalanceRules =
        sellerUser?.role != null && DEMAND_WALLET_EXEMPT_ROLES.has(sellerUser.role as UserRole);

      const sellerWallet = await tx.wallet.findUnique({ where: { userId: stall.merchant.userId } });
      if (!sellerWallet) throw new NotFoundException('Seller wallet not found');
      if (!skipSellerBalanceRules) {
        const minSeller = new Prisma.Decimal(SELLER_MIN_WALLET_USD);
        if (sellerWallet.availableBalance.lt(minSeller)) {
          throw new BadRequestException(
            `Wallet balance must be at least $${SELLER_MIN_WALLET_USD.toFixed(2)} to complete a demand sale. ` +
              `Current: $${sellerWallet.availableBalance.toFixed(2)}. Please top up.`,
          );
        }
      }

      // Build sale items — use offer items if present, otherwise a single aggregated line
      const saleItems: Array<{
        variantId: string;
        productName: string;
        variantName: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        costPrice: Prisma.Decimal;
        discount: Prisma.Decimal;
        totalPrice: Prisma.Decimal;
      }> = [];

      if (offer.items && offer.items.length > 0) {
        // Aggregate quantities per variantId so duplicate lines don't create
        // stale previousQty / newQty values or bypass the stock check.
        const qtyByVariant = new Map<string, number>();
        for (const item of offer.items) {
          if (!item.variant) continue;
          qtyByVariant.set(item.variantId, (qtyByVariant.get(item.variantId) ?? 0) + item.quantity);
        }

        for (const item of offer.items) {
          if (!item.variant) continue;
          const itemPrice = new Prisma.Decimal(item.price);
          const lineTotal = itemPrice.mul(item.quantity);

          saleItems.push({
            variantId: item.variantId,
            productName: item.variant.product.name,
            variantName: item.variant.name,
            quantity: item.quantity,
            unitPrice: itemPrice,
            costPrice: item.variant.costPrice ?? new Prisma.Decimal(0),
            discount: new Prisma.Decimal(0),
            totalPrice: lineTotal,
          });
        }

        // Stock check + decrement: one pass per unique variant, using aggregated qty.
        for (const [variantId, totalQty] of qtyByVariant) {
          const item = offer.items.find((i) => i.variantId === variantId && i.variant);
          if (!item || !item.variant?.inventory) continue;
          const inv = item.variant.inventory;
          const available = inv.quantity - inv.reservedQty;
          if (available < totalQty) {
            throw new BadRequestException(
              `Insufficient stock for ${item.variant.product.name}. Available: ${available}, needed: ${totalQty}`,
            );
          }
          await tx.inventory.update({
            where: { id: inv.id },
            data: { quantity: { decrement: totalQty } },
          });
          await tx.inventoryLog.create({
            data: {
              inventoryId: inv.id,
              changeQty: -totalQty,
              previousQty: inv.quantity,
              newQty: inv.quantity - totalQty,
              reason: 'DEMAND_SALE',
              referenceId: demandId,
              referenceType: 'buyer_demand',
              performedBy: cashierId,
            },
          });
        }
      }

      // If no variant items — use the demand title as a single line item
      if (saleItems.length === 0) {
        // Find any variant in the stall to attach the sale to (required by schema)
        const anyVariant = await tx.productVariant.findFirst({
          where: { product: { stallId } },
          include: { product: { select: { name: true } } },
        });
        if (!anyVariant) throw new BadRequestException('No products found in stall to record the sale against. Add at least one product first.');

        saleItems.push({
          variantId: anyVariant.id,
          productName: demand.title,
          variantName: 'Demand Sale',
          quantity: 1,
          unitPrice: totalAmount,
          costPrice: new Prisma.Decimal(0),
          discount: new Prisma.Decimal(0),
          totalPrice: totalAmount,
        });
      }

      // Generate receipt number
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      const today = `${yyyy}${mm}${dd}`;
      const startOfDayUTC = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate()));
      const todayCount = await tx.pOSSale.count({
        where: { stallId, createdAt: { gte: startOfDayUTC } },
      });
      const receiptNumber = `M263-${today}-${(todayCount + 1).toString().padStart(4, '0')}`;

      // Create the POS sale record
      const sale = await tx.pOSSale.create({
        data: {
          stallId,
          cashierId,
          receiptNumber,
          subtotal: totalAmount,
          discountAmount: new Prisma.Decimal(0),
          taxAmount: 0,
          totalAmount,
          commissionAmount,
          commissionRate,
          currency: 'USD',
          paymentMethod,
          status: POSSaleStatus.COMPLETED,
          notes: `Demand: ${demand.title}`,
          items: { create: saleItems },
          receipt: {
            create: {
              data: {
                stallName: stall.name,
                stallNumber: stall.stallNumber,
                businessName: stall.merchant.businessName,
                storeLogoUrl: resolveStoreLogo(stall, stall.merchant),
                items: saleItems.map((i) => ({
                  name: `${i.productName}${i.variantName !== 'Demand Sale' ? ` - ${i.variantName}` : ''}`,
                  qty: i.quantity,
                  price: i.unitPrice.toString(),
                  total: i.totalPrice.toString(),
                })),
                subtotal: totalAmount.toString(),
                discount: '0',
                total: totalAmount.toString(),
                paymentMethod,
                cashier: cashierId,
                date: now.toISOString(),
                demandTitle: demand.title,
              },
            },
          },
        },
        include: { items: true, receipt: true },
      });

      // Mark demand as FULFILLED
      await tx.buyerDemand.update({
        where: { id: demandId },
        data: { status: DemandStatus.FULFILLED },
      });

      // Notify buyer
      await tx.notification.create({
        data: {
          userId: demand.buyer.id,
          type: NotificationType.SALE_COMPLETED,
          title: 'Order Fulfilled',
          body: `Your demand "${demand.title}" has been fulfilled. Receipt: ${receiptNumber}`,
          data: { demandId, saleId: sale.id, receiptNumber },
        },
      });

      return {
        sale,
        receiptNumber,
        saleId: sale.id,
        commission: commissionAmount.toNumber(),
        total: totalAmount.toNumber(),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /**
   * Runs every 5 minutes. Finds all expired BID locks and atomically:
   * 1. Returns locked funds to buyer's availableBalance
   * 2. Marks the WalletLock as RELEASED
   * 3. Records a BID_UNLOCK wallet transaction
   * 4. Marks the demand as EXPIRED if still OPEN
   */
  /**
   * Unified expiry pass — runs every minute.
   * Step 1 (atomic updateMany): expire pending offers and open demands past their window.
   * Step 2 (per-lock transaction): release expired BID wallet locks and return funds.
   * Step 2 also expires any demand tied to a released lock as a belt-and-suspenders guarantee.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async runExpiryPass() {
    const now = new Date();

    // Step 1 — expire offers and open demands atomically in one transaction
    const [offerResult, demandResult] = await this.prisma.$transaction([
      this.prisma.sellerOffer.updateMany({
        where: { status: OfferStatus.PENDING, expiresAt: { lt: now } },
        data: { status: OfferStatus.EXPIRED },
      }),
      this.prisma.buyerDemand.updateMany({
        where: { status: DemandStatus.OPEN, expiresAt: { lt: now } },
        data: { status: DemandStatus.EXPIRED },
      }),
    ]);

    if (offerResult.count > 0) this.logger.log(`Expired ${offerResult.count} pending offer(s)`);
    if (demandResult.count > 0) this.logger.log(`Expired ${demandResult.count} open demand(s)`);

    // Step 2 — release expired BID locks and return funds (each lock is its own financial transaction)
    const expiredLocks = await this.prisma.walletLock.findMany({
      where: { status: WalletLockStatus.ACTIVE, reason: WalletLockReason.BID, expiresAt: { lt: now } },
      include: { wallet: true },
    });

    if (expiredLocks.length === 0) return;
    this.logger.log(`Releasing ${expiredLocks.length} expired BID lock(s)`);

    for (const lock of expiredLocks) {
      try {
        await this.prisma.$retryTransaction(
          async (tx) => {
            const ts = new Date();
            const wallet = await tx.wallet.findUnique({ where: { id: lock.walletId } });
            if (!wallet) return;

            const newAvailable = wallet.availableBalance.add(lock.amount);
            const newLocked = Prisma.Decimal.max(new Prisma.Decimal(0), wallet.lockedBalance.sub(lock.amount));

            await tx.walletLock.update({
              where: { id: lock.id },
              data: { status: WalletLockStatus.RELEASED, releasedAt: ts },
            });
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { availableBalance: newAvailable, lockedBalance: newLocked, lastActivityAt: ts },
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
                completedAt: ts,
              },
            });
            // Belt-and-suspenders: ensure the demand is expired even if step 1 missed it
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
