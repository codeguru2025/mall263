import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { DemandStatus, DemandUrgency, OfferStatus, Prisma } from '@prisma/client';

@Injectable()
export class DemandsService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

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
    // Check buyer has funded wallet (FUNDED mode minimum)
    const buyingPower = await this.walletService.getBuyingPowerTier(buyerId);
    if (buyingPower.tier === 'FREE') {
      throw new BadRequestException('You must fund your wallet to post demand requests');
    }

    // Check 10% rule for ACTIVE BUYER
    const bidCheck = await this.walletService.canPlaceBid(buyerId, data.maxBudget);
    if (!bidCheck.allowed) {
      throw new BadRequestException(
        `Need $${bidCheck.required.toFixed(2)} (10% of $${data.maxBudget}) in wallet. Available: $${bidCheck.available.toFixed(2)}`
      );
    }

    const expiresAt = new Date(Date.now() + (data.expiresInHours || 72) * 60 * 60 * 1000);

    const demand = await this.prisma.buyerDemand.create({
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

    // Lock 10% of max budget
    await this.walletService.lockFundsForBid(buyerId, data.maxBudget, demand.id);

    return demand;
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

    return this.prisma.$transaction(async (tx) => {
      // Accept this offer
      await tx.sellerOffer.update({
        where: { id: offerId },
        data: { status: OfferStatus.ACCEPTED, respondedAt: new Date() },
      });

      // Reject all other offers
      await tx.sellerOffer.updateMany({
        where: { demandId: offer.demandId, id: { not: offerId }, status: OfferStatus.PENDING },
        data: { status: OfferStatus.REJECTED, respondedAt: new Date() },
      });

      // Close the demand
      await tx.buyerDemand.update({
        where: { id: offer.demandId },
        data: { status: DemandStatus.MATCHED },
      });

      return { accepted: true, offerId };
    });
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
