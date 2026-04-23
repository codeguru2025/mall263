import { Module } from '@nestjs/common';
import { StallsService } from './stalls.service';
import { StallsController } from './stalls.controller';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [StallsController],
  providers: [StallsService],
  exports: [StallsService],
})
export class StallsModule {}
