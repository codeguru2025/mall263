import { Module } from '@nestjs/common';
import { VirtualWalkService } from './virtual-walk.service';
import { VirtualWalkController } from './virtual-walk.controller';

@Module({
  controllers: [VirtualWalkController],
  providers: [VirtualWalkService],
  exports: [VirtualWalkService],
})
export class VirtualWalkModule {}
