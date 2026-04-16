import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupportRequestsService } from './support-requests.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';

@ApiTags('Support')
@Controller('support-requests')
@UseGuards(OptionalJwtAuthGuard)
export class SupportRequestsController {
  constructor(private supportRequests: SupportRequestsService) {}

  @Post()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit a help / support request (signed-in or guest with phone)' })
  async create(
    @Body() dto: CreateSupportRequestDto,
    @CurrentUser() user?: { id: string; phone: string; firstName: string; lastName: string } | null,
  ) {
    return this.supportRequests.create(dto, user ?? undefined);
  }
}
