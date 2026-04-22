import { Module } from '@nestjs/common';
import { MallsService } from './malls.service';
import { MallsController } from './malls.controller';

@Module({
  controllers: [MallsController],
  providers: [MallsService],
  exports: [MallsService],
})
export class MallsModule {}
