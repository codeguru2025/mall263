import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway,
  ) {}

  @Get('rooms')
  @ApiOperation({ summary: 'Get my chat rooms' })
  async getMyRooms(@CurrentUser('id') userId: string) {
    return this.chatService.getMyRooms(userId);
  }

  @Post('rooms/:offerId')
  @ApiOperation({ summary: 'Get or create a chat room for an accepted offer' })
  async getOrCreateRoom(@Param('offerId') offerId: string, @CurrentUser('id') userId: string) {
    return this.chatService.getOrCreateRoom(offerId, userId);
  }

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get messages in a chat room' })
  async getMessages(
    @Param('roomId') roomId: string,
    @CurrentUser('id') userId: string,
    @Query('after') after?: string,
  ) {
    return this.chatService.getMessages(roomId, userId, after);
  }

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
