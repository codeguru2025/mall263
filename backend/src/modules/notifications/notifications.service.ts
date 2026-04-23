import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ─── Save Expo push token for a user ─────────────────────────────────────

  async savePushToken(userId: string, token: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { pushToken: token },
      select: { id: true },
    });
  }

  // ─── Send in-app notification + optional push ─────────────────────────────

  async send(userId: string, type: NotificationType, title: string, body: string, data?: any) {
    const [notification, user] = await Promise.all([
      this.prisma.notification.create({
        data: { userId, type, title, body, data },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } }),
    ]);

    // Fire-and-forget push — never let push failure affect the caller
    if (user?.pushToken) {
      this.sendExpoPush(user.pushToken, title, body, data).catch(() => {});
    }

    return notification;
  }

  // ─── Get notifications (paginated) ────────────────────────────────────────

  async getMyNotifications(userId: string, params: { isRead?: boolean; page?: number; limit?: number }) {
    const { isRead } = params;
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.min(Math.max(1, params.limit!), 200) : 20;
    const where: any = { userId };
    if (isRead !== undefined) where.isRead = isRead;

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { data, total, unreadCount, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Mark one / all as read ────────────────────────────────────────────────

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ─── Internal: call Expo push API ─────────────────────────────────────────

  private async sendExpoPush(token: string, title: string, body: string, data?: any) {
    const isChatMessage = data?.type === 'NEW_MESSAGE' || data?.type === 'chat';
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data ?? {},
        sound: isChatMessage ? null : 'default',
        channelId: isChatMessage ? 'chat' : 'default',
      }),
    });
  }
}
