import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DriverTier, UserRole } from '@prisma/client';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drivers')
export class DriversController {
  constructor(private drivers: DriversService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register as a driver' })
  register(
    @CurrentUser('id') userId: string,
    @Body() body: { vehicleType?: string; kycDocUrl?: string },
  ) {
    return this.drivers.register(userId, body);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my driver profile' })
  getMe(@CurrentUser('id') userId: string) {
    return this.drivers.getProfile(userId);
  }

  @Patch('me/location')
  @ApiOperation({ summary: 'Update my current location' })
  updateLocation(
    @CurrentUser('id') userId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.drivers.updateLocation(userId, body.lat, body.lng);
  }

  @Get('me/earnings')
  @ApiOperation({ summary: 'Get my earnings and float balance' })
  getEarnings(@CurrentUser('id') userId: string) {
    return this.drivers.getEarnings(userId);
  }

  @Post('me/float/top-up')
  @ApiOperation({ summary: 'Top up my float voluntarily' })
  topUpFloat(@CurrentUser('id') userId: string, @Body() body: { amount: number }) {
    return this.drivers.topUpFloat(userId, body.amount);
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  @ApiOperation({ summary: 'List all drivers (admin)' })
  listAll(
    @Query('tier') tier?: DriverTier,
    @Query('active') active?: string,
    @Query('page') page?: number,
  ) {
    return this.drivers.listAll({
      tier,
      active: active === undefined ? undefined : active === 'true',
      page: Number(page) || 1,
    });
  }

  @Patch(':id/kyc-approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve driver KYC (admin)' })
  approveKyc(@Param('id') id: string) {
    return this.drivers.approveKyc(id);
  }

  @Patch(':id/tier')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually update driver tier (admin)' })
  updateTier(@Param('id') id: string, @Body() body: { tier: DriverTier }) {
    return this.drivers.updateTier(id, body.tier);
  }
}
