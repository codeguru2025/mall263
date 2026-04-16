import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, ServiceRequestStatus, ServiceQuoteStatus, ServiceInvoiceStatus } from '@prisma/client';
import { containsContactInfo } from '../../common/contact-info.util';
import { resolveStoreLogo } from '../../common/utils/store-branding';

const BUYER_TRIAL_DAYS = 7;

// ── Invoice number generation ─────────────────────────────────────────────────
// Format: SVC-YYYYMMDD-NNNN   (mirrors M263-YYYYMMDD-NNNN used for POS receipts)
async function nextInvoiceNumber(prisma: PrismaService): Promise<string> {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(now.getUTCDate()).padStart(2, '0');
  const prefix = `SVC-${yyyy}${mm}${dd}`;
  const startOfDay = new Date(Date.UTC(yyyy, now.getUTCMonth(), now.getUTCDate()));
  const count = await prisma.serviceInvoice.count({
    where: { createdAt: { gte: startOfDay } },
  });
  return `${prefix}-${(count + 1).toString().padStart(4, '0')}`;
}

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // ── Browse & detail ──────────────────────────────────────────────────────────

  async browse(params: {
    categoryId?: string;
    mallId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = Number.isFinite(params.page)  ? Math.max(1, params.page!)          : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(50, params.limit!)) : 20;
    const where: any = { isActive: true };
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.mallId)     where.mallId     = params.mallId;
    if (params.q?.trim()) {
      where.OR = [
        { title:       { contains: params.q.trim(), mode: 'insensitive' } },
        { description: { contains: params.q.trim(), mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceListing.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          mall:     { select: { id: true, name: true, city: true } },
          stall:    { select: { id: true, name: true, stallNumber: true } },
          provider: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.serviceListing.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async findById(id: string, userId?: string) {
    const row = await this.prisma.serviceListing.findFirst({
      where: { id, isActive: true },
      include: {
        category: true,
        mall:     true,
        stall:    true,
        provider: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!row) throw new NotFoundException('Service not found');

    await this.prisma.serviceListing.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    // Gate provider phone and stall number — same wallet/trial rule as products
    let showDetails = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
      if (user) {
        const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
        if (ageDays < BUYER_TRIAL_DAYS) {
          showDetails = true;
        } else {
          const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
          if (wallet && parseFloat(wallet.availableBalance.toString()) > 0) showDetails = true;
        }
      }
    }

    if (!showDetails) {
      return {
        ...row,
        stall:    row.stall ? { ...row.stall, stallNumber: '***' } : null,
        provider: { id: row.provider.id, firstName: row.provider.firstName, lastName: row.provider.lastName, phone: null },
      };
    }

    return row;
  }

  // ── Create listing ───────────────────────────────────────────────────────────

  async create(
    userId: string,
    role: UserRole,
    data: {
      stallId: string;
      title: string;
      description?: string;
      categoryId?: string;
      priceFrom?: number;
      imageUrl?: string;
    },
  ) {
    if (role !== UserRole.STALL_OWNER && role !== UserRole.ATTENDANT) {
      throw new ForbiddenException('Only sellers can list services');
    }

    const stall = await this.prisma.stall.findUnique({
      where: { id: data.stallId },
      include: { merchant: true, attendants: { where: { userId, isActive: true } } },
    });
    if (!stall) throw new NotFoundException('Stall not found');

    const isOwner    = stall.merchant.userId === userId;
    const isAttendant = stall.attendants.length > 0;
    if (!isOwner && !isAttendant) throw new ForbiddenException('Not your stall');

    for (const [field, value] of Object.entries({ title: data.title, description: data.description })) {
      if (value && containsContactInfo(value)) {
        throw new BadRequestException(
          `Your service listing ${field} contains information that is not allowed — phone numbers, WhatsApp, ` +
          `emails, social handles, links, or contact phrases are not permitted.`,
        );
      }
    }

    return this.prisma.serviceListing.create({
      data: {
        providerId:  userId,
        stallId:     stall.id,
        mallId:      stall.mallId,
        categoryId:  data.categoryId,
        title:       data.title.trim(),
        description: data.description?.trim(),
        priceFrom:   data.priceFrom,
        imageUrl:    data.imageUrl,
      },
      include: { category: true, mall: true, stall: true },
    });
  }

  // ── Service request flow ─────────────────────────────────────────────────────

  async createRequest(clientId: string, listingId: string, data: { notes?: string; budgetHint?: number }) {
    const listing = await this.prisma.serviceListing.findFirst({
      where: { id: listingId, isActive: true },
      include: { provider: { select: { id: true } } },
    });
    if (!listing) throw new NotFoundException('Service not found');
    if (listing.providerId === clientId) throw new BadRequestException('You cannot request your own service');

    return this.prisma.serviceRequest.create({
      data: {
        listingId,
        clientId,
        notes:      data.notes?.trim(),
        budgetHint: data.budgetHint,
        status:     ServiceRequestStatus.OPEN,
      },
      include: {
        listing: { select: { id: true, title: true } },
        client:  { select: { id: true, firstName: true, lastName: true } },
        quotes:  true,
      },
    });
  }

  async getMyRequests(clientId: string) {
    return this.prisma.serviceRequest.findMany({
      where: { clientId },
      include: {
        listing: {
          select: {
            id: true, title: true,
            stall:    { select: { id: true, name: true } },
            provider: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        quotes: {
          include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProviderRequests(providerId: string) {
    return this.prisma.serviceRequest.findMany({
      where: { listing: { providerId } },
      include: {
        listing: { select: { id: true, title: true } },
        client:  { select: { id: true, firstName: true, lastName: true, phone: true } },
        quotes: {
          where: { providerId },
          include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(requestId: string, userId: string) {
    const req = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: {
        listing: {
          include: {
            stall:    { include: { merchant: { select: { logoUrl: true, businessName: true } } } },
            provider: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        quotes: {
          include: {
            invoice:  { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
            chatRoom: { select: { id: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.clientId !== userId && req.listing.providerId !== userId) {
      throw new ForbiddenException('Not authorized');
    }
    return req;
  }

  // ── Quote flow ───────────────────────────────────────────────────────────────

  async submitQuote(
    providerId: string,
    requestId: string,
    data: { amount: number; description?: string; estimatedDays?: number },
  ) {
    const req = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: { listing: { select: { providerId: true, title: true } } },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.listing.providerId !== providerId) throw new ForbiddenException('Not your listing');
    if (req.status === ServiceRequestStatus.CANCELLED) throw new BadRequestException('Request is cancelled');
    if (req.status === ServiceRequestStatus.COMPLETED)  throw new BadRequestException('Request is already completed');

    // One active quote per provider per request
    const existing = await this.prisma.serviceQuote.findFirst({
      where: { requestId, providerId, status: ServiceQuoteStatus.PENDING },
    });
    if (existing) throw new BadRequestException('You already have a pending quote on this request');

    const [quote] = await this.prisma.$transaction([
      this.prisma.serviceQuote.create({
        data: {
          requestId,
          providerId,
          amount:        data.amount,
          description:   data.description?.trim(),
          estimatedDays: data.estimatedDays,
          status:        ServiceQuoteStatus.PENDING,
        },
        include: { request: { select: { id: true, clientId: true } } },
      }),
      this.prisma.serviceRequest.update({
        where: { id: requestId },
        data: { status: ServiceRequestStatus.QUOTED },
      }),
    ]);

    return quote;
  }

  async acceptQuote(clientId: string, quoteId: string) {
    const quote = await this.prisma.serviceQuote.findUnique({
      where: { id: quoteId },
      include: { request: true },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.request.clientId !== clientId) throw new ForbiddenException('Not your request');
    if (quote.status !== ServiceQuoteStatus.PENDING) throw new BadRequestException('Quote is no longer pending');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.serviceQuote.update({
        where: { id: quoteId },
        data: { status: ServiceQuoteStatus.ACCEPTED, respondedAt: now },
      }),
      // Reject all other pending quotes on this request
      this.prisma.serviceQuote.updateMany({
        where: { requestId: quote.requestId, id: { not: quoteId }, status: ServiceQuoteStatus.PENDING },
        data: { status: ServiceQuoteStatus.REJECTED, respondedAt: now },
      }),
      this.prisma.serviceRequest.update({
        where: { id: quote.requestId },
        data: { status: ServiceRequestStatus.ACCEPTED },
      }),
    ]);

    // Open a chat room for coordination
    await this.prisma.serviceChatRoom.upsert({
      where: { quoteId },
      update: {},
      create: { quoteId },
    });

    return { accepted: true, quoteId };
  }

  async rejectQuote(clientId: string, quoteId: string) {
    const quote = await this.prisma.serviceQuote.findUnique({
      where: { id: quoteId },
      include: { request: { select: { clientId: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.request.clientId !== clientId) throw new ForbiddenException('Not your request');
    if (quote.status !== ServiceQuoteStatus.PENDING) throw new BadRequestException('Quote is no longer pending');

    await this.prisma.serviceQuote.update({
      where: { id: quoteId },
      data: { status: ServiceQuoteStatus.REJECTED, respondedAt: new Date() },
    });

    return { rejected: true, quoteId };
  }

  // ── Complete service + invoice ────────────────────────────────────────────────

  async completeService(providerId: string, quoteId: string, data: { paymentMethod: string }) {
    const quote = await this.prisma.serviceQuote.findUnique({
      where: { id: quoteId },
      include: {
        request: {
          include: {
            listing: {
              include: {
                stall: {
                  include: {
                    mall:     { select: { name: true, city: true } },
                    merchant: { select: { businessName: true, logoUrl: true } },
                  },
                },
                provider: { select: { firstName: true, lastName: true } },
              },
            },
            client: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
        invoice: true,
      },
    });
    if (!quote)  throw new NotFoundException('Quote not found');
    if (quote.providerId !== providerId) throw new ForbiddenException('Not your quote');
    if (quote.status !== ServiceQuoteStatus.ACCEPTED) throw new BadRequestException('Quote must be accepted before completion');
    if (quote.invoice) throw new BadRequestException('Invoice already issued for this quote');

    const { listing, client } = quote.request;
    const stall   = listing.stall;
    const invoiceNumber = await nextInvoiceNumber(this.prisma);

    const invoiceData = {
      invoiceNumber,
      serviceTitle:       listing.title,
      serviceDescription: listing.description ?? null,
      quoteDescription:   quote.description   ?? null,
      estimatedDays:      quote.estimatedDays  ?? null,
      providerName:  `${listing.provider.firstName} ${listing.provider.lastName}`,
      businessName:  stall?.merchant?.businessName ?? listing.provider.firstName,
      stallName:     stall?.name          ?? null,
      stallNumber:   stall?.stallNumber   ?? null,
      stallAddress:  stall?.address ?? null,
      mallName:      stall?.mall?.name    ?? null,
      mallCity:      stall?.mall?.city    ?? null,
      storeLogoUrl:  stall ? resolveStoreLogo(stall, stall.merchant) : null,
      clientName:    `${client.firstName} ${client.lastName}`,
      clientPhone:   client.phone,
      amount:        Number(quote.amount),
      paymentMethod: data.paymentMethod,
      date:          new Date().toISOString(),
      appName:       'Mall263',
    };

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.serviceInvoice.create({
        data: {
          quoteId,
          invoiceNumber,
          data:          invoiceData,
          totalAmount:   quote.amount,
          paymentMethod: data.paymentMethod,
          status:        ServiceInvoiceStatus.PENDING,
        },
      });
      await tx.serviceRequest.update({
        where: { id: quote.requestId },
        data: { status: ServiceRequestStatus.COMPLETED },
      });
      await tx.serviceQuote.update({
        where: { id: quoteId },
        data: { status: ServiceQuoteStatus.ACCEPTED }, // stays ACCEPTED
      });
      return inv;
    });

    return invoice;
  }

  async getInvoice(invoiceId: string, userId: string) {
    const inv = await this.prisma.serviceInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        quote: {
          include: {
            request: {
              select: { clientId: true, listing: { select: { providerId: true } } },
            },
          },
        },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');

    const clientId   = inv.quote.request.clientId;
    const providerId = inv.quote.request.listing.providerId;
    if (userId !== clientId && userId !== providerId) throw new ForbiddenException('Not authorized');

    return inv;
  }

  async markInvoicePaid(invoiceId: string, providerId: string) {
    const inv = await this.prisma.serviceInvoice.findUnique({
      where: { id: invoiceId },
      include: { quote: { select: { providerId: true } } },
    });
    if (!inv)  throw new NotFoundException('Invoice not found');
    if (inv.quote.providerId !== providerId) throw new ForbiddenException('Not your invoice');
    if (inv.status !== ServiceInvoiceStatus.PENDING) throw new BadRequestException('Invoice is not pending');

    return this.prisma.serviceInvoice.update({
      where: { id: invoiceId },
      data: { status: ServiceInvoiceStatus.PAID },
    });
  }

  // ── Service chat ─────────────────────────────────────────────────────────────

  async getOrCreateServiceChatRoom(quoteId: string, userId: string) {
    const quote = await this.prisma.serviceQuote.findUnique({
      where: { id: quoteId },
      include: { request: { select: { clientId: true, listing: { select: { providerId: true } } } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');

    const clientId   = quote.request.clientId;
    const providerId = quote.request.listing.providerId;
    if (userId !== clientId && userId !== providerId) throw new ForbiddenException('Not authorized');
    if (quote.status !== ServiceQuoteStatus.ACCEPTED) {
      throw new BadRequestException('Chat is only available after the quote has been accepted.');
    }

    return this.prisma.serviceChatRoom.upsert({
      where: { quoteId },
      update: {},
      create: { quoteId },
    });
  }

  private async verifyServiceRoomAccess(roomId: string, userId: string) {
    const room = await this.prisma.serviceChatRoom.findUnique({
      where: { id: roomId },
      include: {
        quote: {
          select: {
            status:    true,
            providerId: true,
            request:   { select: { clientId: true } },
          },
        },
      },
    });
    if (!room) throw new NotFoundException('Chat room not found');

    const clientId   = room.quote.request.clientId;
    const providerId = room.quote.providerId;
    if (userId !== clientId && userId !== providerId) throw new ForbiddenException('Not authorized');

    return room;
  }

  async getServiceMessages(roomId: string, userId: string, after?: string) {
    await this.verifyServiceRoomAccess(roomId, userId);
    const where: any = { roomId };
    if (after) where.createdAt = { gt: new Date(after) };
    return this.prisma.serviceChatMessage.findMany({
      where,
      include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async sendServiceMessage(roomId: string, senderId: string, content: string) {
    const room = await this.verifyServiceRoomAccess(roomId, senderId);

    // Allow contact info only after quote is accepted (same rule as product chat)
    const quoteAccepted = room.quote.status === ServiceQuoteStatus.ACCEPTED;
    if (!quoteAccepted && containsContactInfo(content)) {
      throw new BadRequestException(
        'Messages cannot contain contact information until the quote is accepted.',
      );
    }

    return this.prisma.serviceChatMessage.create({
      data: { roomId, senderId, content },
      include: { sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
  }

  async getMyServiceChatRooms(userId: string) {
    return this.prisma.serviceChatRoom.findMany({
      where: {
        quote: {
          OR: [
            { request: { clientId: userId } },
            { providerId: userId },
          ],
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        quote: {
          select: {
            id: true, amount: true, status: true,
            providerId: true,
            request: {
              select: {
                clientId: true,
                listing: { select: { title: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
