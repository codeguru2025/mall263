import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

type AuthPayload = {
  sub: string;
};

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const userId = this.extractAndVerifyUserId(client);
      client.data.userId = userId;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    // No-op; socket.io handles room cleanup.
  }

  @SubscribeMessage('chat.join')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string },
  ): Promise<{ ok: true; roomId: string }> {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new UnauthorizedException('Unauthorized socket');
    const roomId = body?.roomId?.trim();
    if (!roomId) throw new ForbiddenException('Missing room id');

    await this.chatService.assertRoomAccess(roomId, userId);
    await client.join(roomId);
    return { ok: true, roomId };
  }

  emitRoomMessage(roomId: string, message: unknown) {
    this.server.to(roomId).emit('chat.message', message);
  }

  private extractAndVerifyUserId(client: Socket): string {
    const authHeader = client.handshake.headers.authorization;
    const authToken = client.handshake.auth?.token as string | undefined;
    const queryToken = client.handshake.query?.token as string | undefined;
    const rawToken = authToken || queryToken || authHeader;
    if (!rawToken) throw new UnauthorizedException('Missing auth token');
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;

    const payload = this.jwtService.verify<AuthPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
    });
    if (!payload?.sub) throw new UnauthorizedException('Invalid token');
    return payload.sub;
  }
}
