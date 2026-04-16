import { Module } from '@nestjs/common';
import { SupportRequestsService } from './support-requests.service';
import { SupportRequestsController } from './support-requests.controller';
import { SupportRequestsAdminController } from './support-requests-admin.controller';

@Module({
  controllers: [SupportRequestsController, SupportRequestsAdminController],
  providers: [SupportRequestsService],
  exports: [SupportRequestsService],
})
export class SupportModule {}
