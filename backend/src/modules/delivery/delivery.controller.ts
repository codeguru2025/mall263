import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeliveryMode, UserRole } from '@prisma/client';

function validateGps(lat: number, lng: number) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new BadRequestException('GPS coordinates must be numbers');
  }
  if (lat < -90 || lat > 90) throw new BadRequestException('Latitude must be between -90 and 90');
  if (lng < -180 || lng > 180) throw new BadRequestException('Longitude must be between -180 and 180');
}

@ApiTags('Delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('delivery')
export class DeliveryController {
  constructor(private delivery: DeliveryService) {}

  @Post('jobs')
  @ApiOperation({ summary: 'Create a delivery job' })
  async createJob(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      orderId: string;
      orderType: 'OFFER' | 'POS_SALE';
      mode: DeliveryMode;
      pickupZone: string;
      dropZone: string;
      pickupAddress: string;
      dropAddress: string;
      pickupLat?: number;
      pickupLng?: number;
      dropLat?: number;
      dropLng?: number;
      distanceKm?: number;
      itemAmount: number;
      deliveryFee: number;
    },
  ) {
    if (!body.orderId) {
      throw new BadRequestException('orderId is required');
    }
    if (isNaN(Number(body.itemAmount)) || Number(body.itemAmount) <= 0) {
      throw new BadRequestException('itemAmount must be a positive number');
    }
    if (isNaN(Number(body.deliveryFee)) || Number(body.deliveryFee) < 0) {
      throw new BadRequestException('deliveryFee must be a non-negative number');
    }
    // buyerId always comes from the JWT — never trust the request body for this.
    // sellerId is derived from the order record server-side in createJob.
    return this.delivery.createJob({ ...body, buyerId: userId });
  }

  @Get('jobs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS, UserRole.FINANCE_ADMIN)
  @ApiOperation({ summary: 'Admin: list all delivery jobs' })
  async listAllJobs(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
  ) {
    return this.delivery.listAllJobs({ status, limit, page });
  }

  @Get('jobs/broadcast')
  @ApiOperation({ summary: 'Get broadcast jobs (drivers only — zone visibility)' })
  async getBroadcast(@CurrentUser('id') userId: string) {
    const driver = await this.delivery['prisma'].driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return this.delivery.getBroadcastJobs(driver.id);
  }

  @Get('jobs/my')
  @ApiOperation({ summary: 'Get my delivery jobs' })
  async getMyJobs(
    @CurrentUser('id') userId: string,
    @Query('role') role: 'buyer' | 'seller' | 'driver' = 'buyer',
  ) {
    return this.delivery.getMyJobs(userId, role);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job details' })
  async getJob(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.delivery.getJob(id, userId);
  }

  @Post('jobs/:id/accept')
  @ApiOperation({ summary: 'Driver accepts a broadcast job' })
  async accept(@Param('id') jobId: string, @CurrentUser('id') userId: string) {
    const driver = await this.delivery['prisma'].driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found — register as a driver first');
    return this.delivery.acceptJob(jobId, driver.id);
  }

  @Post('jobs/:id/pickup-confirm')
  @ApiOperation({ summary: 'Driver submits pickup proof' })
  async confirmPickup(
    @Param('id') jobId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { photoUrl: string; gpsLat: number; gpsLng: number },
  ) {
    validateGps(body.gpsLat, body.gpsLng);
    const driver = await this.delivery['prisma'].driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return this.delivery.confirmPickup(jobId, driver.id, body);
  }

  @Post('jobs/:id/deliver')
  @ApiOperation({ summary: 'Driver submits delivery proof' })
  async confirmDelivery(
    @Param('id') jobId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { photoUrl: string; gpsLat: number; gpsLng: number },
  ) {
    validateGps(body.gpsLat, body.gpsLng);
    const driver = await this.delivery['prisma'].driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return this.delivery.confirmDelivery(jobId, driver.id, body);
  }

  @Post('jobs/:id/confirm-receipt')
  @ApiOperation({ summary: 'Buyer confirms receipt (releases escrow)' })
  async confirmReceipt(@Param('id') jobId: string, @CurrentUser('id') userId: string) {
    return this.delivery.buyerConfirm(jobId, userId);
  }

  @Post('jobs/:id/cancel')
  @ApiOperation({ summary: 'Cancel a delivery job' })
  async cancel(
    @Param('id') jobId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { reason: string },
  ) {
    return this.delivery.cancelJob(jobId, userId, body.reason);
  }
}
