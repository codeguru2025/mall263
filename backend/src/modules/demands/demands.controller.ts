import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DemandsService } from './demands.service';
import { DemandRankingService } from './demand-ranking.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, DemandStatus, DemandUrgency } from '@prisma/client';

@ApiTags('Demands & Offers')
@Controller('demands')
export class DemandsController {
  constructor(
    private demandsService: DemandsService,
    private rankingService: DemandRankingService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Post a demand request (buyer)' })
  async createDemand(@CurrentUser('id') buyerId: string, @Body() data: any) {
    return this.demandsService.createDemand(buyerId, data);
  }

  @Get('open')
  @Public()
  @ApiOperation({ summary: 'Browse open demands (sellers see these)' })
  async getOpenDemands(
    @Query('categoryId') categoryId?: string,
    @Query('mallId') mallId?: string,
    @Query('urgency') urgency?: DemandUrgency,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.demandsService.getOpenDemands({ categoryId, mallId, urgency, page, limit });
  }

  @Get('ranked')
  @Public()
  @ApiOperation({ summary: 'Get ranked demands with algorithmic scoring (urgency + trust + time decay)' })
  async getRankedDemands(
    @Query('categoryId') categoryId?: string,
    @Query('mallId') mallId?: string,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
    @Query('maxDistance') maxDistance?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.rankingService.getRankedDemands({
      categoryId,
      mallId,
      latitude: lat,
      longitude: lng,
      maxDistanceKm: maxDistance,
      page,
      limit,
    });
  }

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Get trending demands (high score + recent activity)' })
  async getTrendingDemands(@Query('limit') limit?: number) {
    return this.rankingService.getTrendingDemands(limit);
  }

  @Get('urgent')
  @Public()
  @ApiOperation({ summary: 'Get urgent demands expiring soon (< 6 hours)' })
  async getUrgentDemands(@Query('limit') limit?: number) {
    return this.rankingService.getUrgentDemands(limit);
  }

  @Get('my')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my demands (buyer)' })
  async getMyDemands(@CurrentUser('id') buyerId: string, @Query('status') status?: DemandStatus) {
    return this.demandsService.getMyDemands(buyerId, status);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get demand by ID with offers' })
  async getDemandById(@Param('id') id: string) {
    return this.demandsService.getDemandById(id);
  }

  @Post(':demandId/offers')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Submit an offer for a demand (seller)' })
  async submitOffer(@Param('demandId') demandId: string, @Body() data: any) {
    return this.demandsService.submitOffer(data.stallId, demandId, data);
  }

  @Post('offers/:offerId/accept')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Accept an offer (buyer)' })
  async acceptOffer(@CurrentUser('id') buyerId: string, @Param('offerId') offerId: string) {
    return this.demandsService.acceptOffer(buyerId, offerId);
  }

  @Get('stall/:stallId/offers')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get offers for a stall' })
  async getStallOffers(@Param('stallId') stallId: string) {
    return this.demandsService.getOffersForStall(stallId);
  }

  @Get('delivery/rate')
  @Public()
  @ApiOperation({ summary: 'Get current delivery rate per km' })
  async getDeliveryRate() {
    return this.demandsService.getDeliveryRate();
  }

  @Post('offers/:offerId/delivery')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Request delivery for an accepted offer (buyer)' })
  async requestDelivery(@CurrentUser('id') buyerId: string, @Param('offerId') offerId: string, @Body() data: any) {
    return this.demandsService.requestDelivery(offerId, buyerId, data);
  }

  @Patch(':id/fulfill')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Complete a demand sale — records POS sale, generates receipt, marks fulfilled (seller)' })
  async completeDemandSale(
    @Param('id') id: string,
    @CurrentUser('id') cashierId: string,
    @Body() data: { stallId: string; paymentMethod: string },
  ) {
    return this.demandsService.completeDemandSale(id, data.stallId, cashierId, data.paymentMethod as any);
  }
}
