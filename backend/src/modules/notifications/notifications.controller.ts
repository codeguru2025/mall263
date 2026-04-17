import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('push-token')
  @ApiOperation({ summary: 'Register Expo push token' })
  async savePushToken(
    @CurrentUser('id') userId: string,
    @Body() body: { token: string },
  ) {
    if (!body.token?.startsWith('ExponentPushToken[')) {
      throw new BadRequestException('Invalid Expo push token format');
    }
    return this.notificationsService.savePushToken(userId, body.token);
  }

  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  async getMyNotifications(
    @CurrentUser('id') userId: string,
    @Query('isRead') isRead?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getMyNotifications(userId, { isRead, page, limit });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }
}
