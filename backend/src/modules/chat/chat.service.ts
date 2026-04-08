import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  private async verifyAccess(offerId: string, userId: string) {
    const offer = await this.prisma.sellerOffer.findUnique({
      where: { id: offerId },
      include: {
        demand: { select: { buyerId: true } },
        stall: { select: { merchant: { select: { userId: true } } } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    const buyerId = offer.demand.buyerId;
    const sellerId = offer.stall.merchant.userId;
    if (userId !== buyerId && userId !== sellerId) throw new ForbiddenException('Not authorized');
    return { offer, buyerId, sellerId };
  }

  private async verifyRoomAccess(roomId: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      select: { offerId: true },
    });
    if (!room) throw new NotFoundException('Chat room not found');
    await this.verifyAccess(room.offerId, userId);
    return room;
  }

  async getOrCreateRoom(offerId: string, userId: string) {
    await this.verifyAccess(offerId, userId);
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
    await this.verifyRoomAccess(roomId, senderId);
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
          ],
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { firstName: true } } },
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
