import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Bumped per-deploy so clients can confirm which backend revision they are
// actually talking to. Keep this as a plain string so it survives minification.
const CHAT_BUILD_TAG = 'chat-hotfix-2026-04-17-p2023-bulletproof-v2';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway,
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
    return this.chatService.getMyRooms(userId);
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
    return this.chatService.getMessages(roomId, userId, after);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(
    @Param('roomId') roomId: string,
    @CurrentUser('id') senderId: string,
    @Body('content') content: string,
  ) {
    const message = await this.chatService.sendMessage(roomId, senderId, content);
    this.chatGateway.emitRoomMessage(roomId, message);
    return message;
  }
}
