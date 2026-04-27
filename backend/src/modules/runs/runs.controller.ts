import {
  Body, Controller, Delete, Get, Param, Post, Req, UseGuards, HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import { RunsService } from './runs.service';
import { CreateRunDto } from './dto/create-run.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  // ─── Buyer ─────────────────────────────────────────────────────────────────

  @Post()
  create(@Req() req: Request & { user: any }, @Body() dto: CreateRunDto) {
    return this.runsService.createRun(req.user.id, dto);
  }

  @Get('my')
  getMyRuns(@Req() req: Request & { user: any }) {
    return this.runsService.getMyRuns(req.user.id);
  }

  @Get(':runId')
  getById(@Req() req: Request & { user: any }, @Param('runId') runId: string) {
    return this.runsService.getRunById(runId, req.user.id);
  }

  @Post(':runId/bids/:bidId/accept')
  acceptBid(@Req() req: Request & { user: any }, @Param('runId') runId: string, @Param('bidId') bidId: string) {
    return this.runsService.acceptBid(req.user.id, runId, bidId);
  }

  @Post(':runId/confirm')
  confirmReceipt(@Req() req: Request & { user: any }, @Param('runId') runId: string) {
    return this.runsService.confirmReceipt(req.user.id, runId);
  }

  @Post(':runId/cancel')
  cancel(@Req() req: Request & { user: any }, @Param('runId') runId: string) {
    return this.runsService.cancelRun(req.user.id, runId);
  }

  // ─── Driver ────────────────────────────────────────────────────────────────

  @Get('driver/open')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  getOpenRuns(@Req() req: Request & { user: any }) {
    return this.runsService.getOpenRunsForDriver(req.user.driverId ?? req.user.id);
  }

  @Get('driver/active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  getDriverActiveRun(@Req() req: Request & { user: any }) {
    return this.runsService.getDriverActiveRun(req.user.driverId ?? req.user.id);
  }

  @Post(':runId/bids')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  placeBid(@Req() req: Request & { user: any }, @Param('runId') runId: string, @Body() dto: PlaceBidDto) {
    return this.runsService.placeBid(req.user.driverId ?? req.user.id, runId, dto);
  }

  @Delete(':runId/bids/mine')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  withdrawBid(@Req() req: Request & { user: any }, @Param('runId') runId: string) {
    return this.runsService.withdrawBid(req.user.driverId ?? req.user.id, runId);
  }

  @Post(':runId/stops/:stopId/pickup')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  confirmPickup(
    @Req() req: Request & { user: any },
    @Param('runId') runId: string,
    @Param('stopId') stopId: string,
    @Body() dto: ConfirmPickupDto,
  ) {
    return this.runsService.confirmStopPickup(req.user.driverId ?? req.user.id, runId, stopId, dto);
  }

  @Post(':runId/deliver')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  submitDelivery(
    @Req() req: Request & { user: any },
    @Param('runId') runId: string,
    @Body() body: { photoUrl?: string; videoUrl?: string; gpsLat?: number; gpsLng?: number },
  ) {
    return this.runsService.submitDeliveryProof(req.user.driverId ?? req.user.id, runId, body);
  }

  /** Driver gets QR token for a specific pickup stop to show the stall owner */
  @Get(':runId/stops/:stopId/qr')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  getStopQr(
    @Req() req: Request & { user: any },
    @Param('runId') runId: string,
    @Param('stopId') stopId: string,
  ) {
    return this.runsService.getStopQrToken(req.user.id, runId, stopId);
  }

  /** Driver gets QR token for final delivery to show the buyer */
  @Get(':runId/delivery-qr')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  getDeliveryQr(@Req() req: Request & { user: any }, @Param('runId') runId: string) {
    return this.runsService.getDeliveryQrToken(req.user.id, runId);
  }

  /** Driver uploads photo/video proof after collecting goods from a stop */
  @Post(':runId/stops/:stopId/collection-proof')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  uploadCollectionProof(
    @Req() req: Request & { user: any },
    @Param('runId') runId: string,
    @Param('stopId') stopId: string,
    @Body() body: { photoUrl?: string; videoUrl?: string },
  ) {
    return this.runsService.uploadCollectionProof(req.user.id, runId, stopId, body.photoUrl, body.videoUrl);
  }

  /** Any authenticated user scans a QR token — handles both PICKUP and DELIVERY types */
  @Post('scan')
  @HttpCode(200)
  scanQr(@Req() req: Request & { user: any }, @Body() body: { token: string }) {
    return this.runsService.scanQrToken(req.user.id, body.token);
  }

  // ─── Seller ────────────────────────────────────────────────────────────────

  @Get('seller/stops')
  getStallStops(@Req() req: Request & { user: any }) {
    return this.runsService.getStallRunStops(req.user.id);
  }
}
