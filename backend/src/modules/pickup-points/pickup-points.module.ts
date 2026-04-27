import { Module } from '@nestjs/common';
import { PickupPointsService } from './pickup-points.service';
import { PickupPointsController } from './pickup-points.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PickupPointsController],
  providers: [PickupPointsService],
  exports: [PickupPointsService],
})
export class PickupPointsModule {}
