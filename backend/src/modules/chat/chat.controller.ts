import { Controller, Get, Post, Param, Query, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Bumped per-deploy so clients can confirm which backend revision they are
// actually talking to. Keep this as a plain string so it survives minification.
const CHAT_BUILD_TAG = 'chat-2026-04-17-media-attachments-v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway,
    private prisma: PrismaService,
  ) {}

  // Public, unauthenticated version probe so we can verify from the phone /
  // browser which revision of the chat module is live. No Prisma, no auth.
  @Get('_version')
  @ApiOperation({ summary: 'Return the deployed chat module version tag' })
  getVersion() {
    return {
      tag: CHAT_BUILD_TAG,
      commit: process.env.SOURCE_COMMIT ?? process.env.GIT_COMMIT ?? 'unknown',
      deployedAt: process.env.DEPLOY_TIME ?? null,
      now: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('rooms')
  @ApiOperation({ summary: 'Get my chat rooms' })
  async getMyRooms(@CurrentUser('id') userId: string) {
    // Absolute last line of defense: even if every safeguard inside the
    // service somehow leaks an exception, we log it and return an empty
    // list so the mobile inbox never wedges on a 5xx.
    try {
      return await this.chatService.getMyRooms(userId);
    } catch (err) {
      const e = err as { code?: string; message?: string; meta?: unknown };
      this.logger.error(
        `getMyRooms crashed for userId=${userId} code=${e.code ?? 'n/a'} msg=${e.message ?? err} meta=${JSON.stringify(e.meta ?? null)}`,
      );
      if (err instanceof Error && err.stack) this.logger.error(err.stack);
      return [];
    }
  }

  // Authenticated step-by-step diagnostic. Runs each piece of the inbox
  // query in isolation and reports which one (if any) fails, along with
  // the Prisma error code. Safe to call from the phone — never throws.
  @UseGuards(JwtAuthGuard)
  @Get('_debug')
  @ApiOperation({ summary: 'Diagnose chat inbox queries for the current user' })
  async debugInbox(@CurrentUser('id') userId: string) {
    const steps: Array<{
      step: string;
      ok: boolean;
      count?: number;
      code?: string;
      message?: string;
    }> = [];

    const run = async <T>(step: string, fn: () => Promise<T>) => {
      try {
        const result = await fn();
        const count = Array.isArray(result) ? result.length : undefined;
        steps.push({ step, ok: true, count });
        return result;
      } catch (err) {
        const e = err as { code?: string; message?: string };
        steps.push({ step, ok: false, code: e.code, message: e.message ?? String(err) });
        return null;
      }
    };

    const userIdLooksValid = !!userId && UUID_RE.test(userId);
    steps.push({ step: 'userId.uuid-shape', ok: userIdLooksValid, message: userId });
    if (!userIdLooksValid) return { userId, tag: CHAT_BUILD_TAG, steps };

    await run('sellerOffer.findMany({demand.buyerId})', () =>
      this.prisma.sellerOffer.findMany({
        where: { demand: { buyerId: userId } },
        select: { id: true },
      }),
    );
    await run('sellerOffer.findMany({stall.merchant.userId})', () =>
      this.prisma.sellerOffer.findMany({
        where: { stall: { merchant: { userId } } },
        select: { id: true },
      }),
    );
    await run('sellerOffer.findMany({stall.attendants.some.userId})', () =>
      this.prisma.sellerOffer.findMany({
        where: { stall: { attendants: { some: { userId } } } },
        select: { id: true },
      }),
    );
    await run('chatRoom.findMany:minimal', () =>
      this.prisma.chatRoom.findMany({ take: 1, orderBy: { createdAt: 'desc' } }),
    );
    await run('chatRoom.findMany:rich(global)', () =>
      this.prisma.chatRoom.findMany({
        take: 1,
        orderBy: { createdAt: 'desc' },
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
      }),
    );
    await run('user.findUnique', () =>
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    );

    return { userId, tag: CHAT_BUILD_TAG, steps };
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/:offerId')
  @ApiOperation({ summary: 'Get or create a chat room for an accepted offer' })
  async getOrCreateRoom(@Param('offerId') offerId: string, @CurrentUser('id') userId: string) {
    return this.chatService.getOrCreateRoom(offerId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get messages in a chat room' })
  async getMessages(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
    @Query('after') after?: string,
  ) {
    // Mirror getMyRooms: never let a Prisma fault crash the chat room screen.
    // On any unexpected error, return an empty list and log for backend debug.
    try {
      return await this.chatService.getMessages(roomId, userId, after);
    } catch (err) {
      const e = err as { status?: number; code?: string; message?: string; name?: string };
      if (e.status && e.status < 500) throw err; // forward 4xx (forbidden/notfound)
      this.logger.error(
        `getMessages crashed roomId=${roomId} userId=${userId} code=${e.code ?? 'n/a'} msg=${e.message ?? err}`,
      );
      if (err instanceof Error && err.stack) this.logger.error(err.stack);
      return [];
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Send a message (text and/or attachment)' })
  async sendMessage(
    @Param('roomId') roomId: string,
    @CurrentUser('id') senderId: string,
    @Body()
    body: {
      content?: string;
      attachmentUrl?: string | null;
      attachmentType?: string | null;
      attachmentWidth?: number | null;
      attachmentHeight?: number | null;
      attachmentSize?: number | null;
    },
  ) {
    const message = await this.chatService.sendMessage(
      roomId,
      senderId,
      typeof body?.content === 'string' ? body.content : '',
      body?.attachmentUrl
        ? {
            url: body.attachmentUrl,
            type: body.attachmentType ?? 'image',
            width: body.attachmentWidth ?? null,
            height: body.attachmentHeight ?? null,
            size: body.attachmentSize ?? null,
          }
        : undefined,
    );
    this.chatGateway.emitRoomMessage(roomId, message);
    return message;
  }
}
