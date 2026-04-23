import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController, AdsPublicController, PublicSettingsController } from './admin.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [AdminController, AdsPublicController, PublicSettingsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
