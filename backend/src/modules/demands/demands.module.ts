import { Module } from '@nestjs/common';
import { DemandsService } from './demands.service';
import { DemandsController } from './demands.controller';
import { DemandRankingService } from './demand-ranking.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [WalletModule],
  controllers: [DemandsController],
  providers: [DemandsService, DemandRankingService],
  exports: [DemandsService, DemandRankingService],
})
export class DemandsModule {}
