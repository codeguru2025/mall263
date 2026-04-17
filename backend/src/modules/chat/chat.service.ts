import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OfferStatus } from '@prisma/client';
import { containsContactInfo } from '../../common/contact-info.util';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  private async verifyAccess(offerId: string, userId: string) {
    const offer = await this.prisma.sellerOffer.findUnique({
      where: { id: offerId },
      include: {
        demand: { select: { buyerId: true } },
        stall: {
          select: {
            merchant: { select: { userId: true } },
            attendants: {
              select: { userId: true },
            },
          },
        },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    const buyerId = offer.demand.buyerId;
    const sellerId = offer.stall.merchant.userId;
    const isAssignedAttendant = offer.stall.attendants.some((attendant) => attendant.userId === userId);
    if (userId !== buyerId && userId !== sellerId && !isAssignedAttendant) {
      throw new ForbiddenException('Not authorized');
    }
    return { offer, buyerId, sellerId };
  }

  private async verifyRoomAccess(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { offerId: true, offer: { select: { status: true } } },
    });
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
    return this.prisma.chatRoom.findMany({
      where: {
        offer: {
          OR: [
            { demand: { buyerId: userId } },
            { stall: { merchant: { userId } } },
            { stall: { attendants: { some: { userId } } } },
          ],
        },
      },
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
    });
  }
}
