import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OfferStatus } from '@prisma/client';
import { containsContactInfo } from '../../common/contact-info.util';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  // Deep nested includes like `stall.merchant` + `stall.attendants` will
  // throw P2023 at runtime if any joined row stores a malformed @db.Uuid.
  // We split the lookup into independent, flat queries so a bad value in
  // one side can't take down the whole authorization check. The query is
  // also wrapped in a try/catch so we emit a clear BadRequest instead of
  // the generic Prisma 500 the mobile client used to see as a red banner.
  private async verifyAccess(
    offerId: string,
    userId: string,
  ): Promise<{
    offer: { id: string; status: OfferStatus; stallId: string; demandId: string };
    buyerId: string;
    sellerId: string;
  }> {
    if (!offerId || !UUID_RE.test(offerId)) {
      throw new BadRequestException('Invalid offer id');
    }
    if (!userId || !UUID_RE.test(userId)) {
      throw new ForbiddenException('Not authorized');
    }

    let offer: { id: string; status: OfferStatus; stallId: string; demandId: string } | null;
    try {
      offer = await this.prisma.sellerOffer.findUnique({
        where: { id: offerId },
        select: { id: true, status: true, stallId: true, demandId: true },
      });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      this.logger.error(`verifyAccess:offer failed offerId=${offerId} code=${e.code} msg=${e.message}`);
      throw new BadRequestException('Could not load offer — please retry.');
    }
    if (!offer) throw new NotFoundException('Offer not found');

    // Buyer side: look up the demand by the offer's demandId (flat query).
    let buyerId = '';
    try {
      const demand = await this.prisma.buyerDemand.findUnique({
        where: { id: offer.demandId },
        select: { buyerId: true },
      });
      buyerId = demand?.buyerId ?? '';
    } catch (err) {
      const e = err as { code?: string; message?: string };
      this.logger.error(`verifyAccess:demand failed demandId=${offer.demandId} code=${e.code} msg=${e.message}`);
    }

    // Seller side: look up the stall, merchant, and attendants independently
    // so a bad FK in one of them doesn't poison the whole query.
    let sellerId = '';
    let isAssignedAttendant = false;
    try {
      const stall = await this.prisma.stall.findUnique({
        where: { id: offer.stallId },
        select: { merchantId: true },
      });
      if (stall?.merchantId) {
        const merchant = await this.prisma.merchant.findUnique({
          where: { id: stall.merchantId },
          select: { userId: true },
        });
        sellerId = merchant?.userId ?? '';
      }
    } catch (err) {
      const e = err as { code?: string; message?: string };
      this.logger.error(`verifyAccess:stall/merchant failed stallId=${offer.stallId} code=${e.code} msg=${e.message}`);
    }

    try {
      const attendant = await this.prisma.stallAttendant.findFirst({
        where: { stallId: offer.stallId, userId },
        select: { id: true },
      });
      isAssignedAttendant = !!attendant;
    } catch (err) {
      const e = err as { code?: string; message?: string };
      this.logger.error(`verifyAccess:attendant failed stallId=${offer.stallId} code=${e.code} msg=${e.message}`);
    }

    if (userId !== buyerId && userId !== sellerId && !isAssignedAttendant) {
      throw new ForbiddenException('Not authorized');
    }
    return { offer, buyerId, sellerId };
  }

  private async verifyRoomAccess(roomId: string, userId: string) {
    if (!roomId || !UUID_RE.test(roomId)) {
      throw new BadRequestException('Invalid chat room id');
    }
    let room: { offerId: string; offer: { status: OfferStatus } | null } | null;
    try {
      room = await this.prisma.chatRoom.findUnique({
        where: { id: roomId },
        select: { offerId: true, offer: { select: { status: true } } },
      });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      this.logger.error(`verifyRoomAccess:room failed roomId=${roomId} code=${e.code} msg=${e.message}`);
      throw new BadRequestException('Could not load chat room — please retry.');
    }
    if (!room) throw new NotFoundException('Chat room not found');
    await this.verifyAccess(room.offerId, userId);
    return room;
  }

  async assertRoomAccess(roomId: string, userId: string) {
    await this.verifyRoomAccess(roomId, userId);
  }

  async getOrCreateRoom(offerId: string, userId: string) {
    const { offer } = await this.verifyAccess(offerId, userId);
    if (offer.status !== OfferStatus.ACCEPTED) {
      throw new BadRequestException('Chat is only available after the offer has been accepted.');
    }
    return this.prisma.chatRoom.upsert({
      where: { offerId },
      update: {},
      create: { offerId },
    });
  }

  async getMessages(roomId: string, userId: string, after?: string) {
    await this.verifyRoomAccess(roomId, userId);
    const where: any = { roomId };
    if (after) where.createdAt = { gt: new Date(after) };
    return this.prisma.chatMessage.findMany({
      where,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async sendMessage(roomId: string, senderId: string, content: string) {
    const room = await this.verifyRoomAccess(roomId, senderId);

    // Once an offer is accepted the deal is done — allow contact details so
    // buyer and seller can coordinate the physical handover freely.
    // Before acceptance, block contact info to protect the platform's role
    // as the matchmaker and prevent sellers from bypassing subscriptions.
    const offerAccepted = room.offer?.status === OfferStatus.ACCEPTED;
    if (!offerAccepted && containsContactInfo(content)) {
      throw new BadRequestException(
        'Messages cannot contain contact information — phone numbers, WhatsApp, emails, social handles, or links are not allowed until the offer is accepted. ' +
        'Agree on price here first, then you can coordinate the handover.',
      );
    }

    return this.prisma.chatMessage.create({
      data: { roomId, senderId, content },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async getMyRooms(userId: string) {
    // Hard-guard: a malformed sub (e.g. old CUID) would cause Prisma to throw
    // P2023 the moment it hits any @db.Uuid filter. Short-circuit cleanly.
    if (!userId || !UUID_RE.test(userId)) {
      this.logger.warn(`getMyRooms called with non-UUID userId=${JSON.stringify(userId)} — returning []`);
      return [];
    }

    const safe = async <T>(label: string, p: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await p;
      } catch (err) {
        const e = err as { code?: string; message?: string };
        this.logger.error(`getMyRooms:${label} failed — ${e.code ?? ''} ${e.message ?? err}`);
        return fallback;
      }
    };

    const [buyerOffers, sellerOffers, attendantOffers] = await Promise.all([
      safe(
        'buyerOffers',
        this.prisma.sellerOffer.findMany({
          where: { demand: { buyerId: userId } },
          select: { id: true },
        }),
        [] as { id: string }[],
      ),
      safe(
        'sellerOffers',
        this.prisma.sellerOffer.findMany({
          where: { stall: { merchant: { userId } } },
          select: { id: true },
        }),
        [] as { id: string }[],
      ),
      safe(
        'attendantOffers',
        this.prisma.sellerOffer.findMany({
          where: { stall: { attendants: { some: { userId } } } },
          select: { id: true },
        }),
        [] as { id: string }[],
      ),
    ]);

    const offerIdSet = new Set<string>();
    for (const o of [...buyerOffers, ...sellerOffers, ...attendantOffers]) {
      if (o?.id && UUID_RE.test(o.id)) offerIdSet.add(o.id);
    }
    if (offerIdSet.size === 0) return [];

    // Try the full nested query first; if Prisma hates any joined row, fall
    // back to a minimal query that skips the rich includes so the inbox still
    // renders.
    const offerIds = Array.from(offerIdSet);
    const richRooms = await safe(
      'chatRoom.findMany:rich',
      this.prisma.chatRoom.findMany({
        where: { offerId: { in: offerIds } },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, firstName: true } } },
          },
          offer: {
            select: {
              id: true,
              totalPrice: true,
              status: true,
              demand: { select: { title: true } },
              stall: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      null as Awaited<ReturnType<typeof this.prisma.chatRoom.findMany>> | null,
    );
    if (richRooms) return richRooms;

    // Minimal fallback so the user at least sees the rooms that exist.
    return safe(
      'chatRoom.findMany:minimal',
      this.prisma.chatRoom.findMany({
        where: { offerId: { in: offerIds } },
        orderBy: { createdAt: 'desc' },
      }),
      [] as Awaited<ReturnType<typeof this.prisma.chatRoom.findMany>>,
    );
  }
}
