import { Module } from '@nestjs/common';
import { DemandsService } from './demands.service';
import { DemandsController } from './demands.controller';
import { DemandRankingService } from './demand-ranking.service';
import { WalletModule } from '../wallet/wallet.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [WalletModule, SubscriptionsModule],
  controllers: [DemandsController],
  providers: [DemandsService, DemandRankingService],
  exports: [DemandsService, DemandRankingService],
})
export class DemandsModule {}
