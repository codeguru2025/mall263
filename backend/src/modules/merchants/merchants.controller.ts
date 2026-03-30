import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, MerchantStatus } from '@prisma/client';

@ApiTags('Merchants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(private merchantsService: MerchantsService) {}

  @Post('onboard')
  @Roles(UserRole.FIELD_AGENT, UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
  @ApiOperation({ summary: 'Onboard a new merchant (agent/admin)' })
  async onboard(
    @Body() data: { userId: string; businessName: string; businessPhone?: string; businessEmail?: string },
    @CurrentUser('id') agentId: string,
  ) {
    return this.merchantsService.onboardMerchant({ ...data, agentId });
  }

  @Post('me/setup')
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Self-serve merchant + stall setup for new sellers' })
  async setup(
    @CurrentUser('id') userId: string,
    @Body() data: {
      businessName: string;
      businessPhone?: string;
      businessEmail?: string;
      stallName: string;
      stallNumber: string;
      mallId?: string;
      description?: string;
      phone?: string;
    },
  ) {
    return this.merchantsService.selfSetup(userId, data);
  }

  @Get('me')
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Get current merchant profile' })
  async getMyMerchant(@CurrentUser('id') userId: string) {
    return this.merchantsService.getMerchantByUserId(userId);
  }

  @Patch(':id/verify')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
  @ApiOperation({ summary: 'Verify a merchant' })
  async verify(@Param('id') id: string) {
    return this.merchantsService.verifyMerchant(id);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS, UserRole.FIELD_AGENT)
  @ApiOperation({ summary: 'List merchants' })
  async list(
    @Query('status') status?: MerchantStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.merchantsService.listMerchants({ status, page, limit });
  }
}
