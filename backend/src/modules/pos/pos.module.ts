import { Module } from '@nestjs/common';
import { POSService } from './pos.service';
import { POSController } from './pos.controller';
import { WalletModule } from '../wallet/wallet.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [WalletModule, InventoryModule],
  controllers: [POSController],
  providers: [POSService],
  exports: [POSService],
})
export class POSModule {}
