import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WalletModule } from '../wallet/wallet.module';
import { RedisModule } from '../../redis/redis.module';

@Module({
  imports: [WalletModule, RedisModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
