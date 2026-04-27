import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DriverDocumentsController } from './driver-documents.controller';
import { DriverDocumentsService } from './driver-documents.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [DriverDocumentsController],
  providers: [DriverDocumentsService],
  exports: [DriverDocumentsService],
})
export class DriverDocumentsModule {}
