import { Controller, Delete, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StallsService } from './stalls.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { CreateStallDto, UpdateMallDto, UpdatePaymentConfigDto, UpdateStallDto } from './dto/stall.dto';
import { CitiesService } from '../cities/cities.service';

@ApiTags('Stalls')
@Controller('stalls')
export class StallsController {
  constructor(
    private stallsService: StallsService,
    private citiesService: CitiesService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.FIELD_AGENT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a stall' })
  async create(@Body() data: CreateStallDto, @CurrentUser('id') userId: string) {
    return this.stallsService.create(data, userId);
  }

  @Get('malls')
  @Public()
  @ApiOperation({ summary: 'List active malls (public)' })
  async listMalls(@Query('city') city?: string) {
    return this.stallsService.listMalls(city);
  }

  /** Must be registered before @Get(':id') — "cities" is not a UUID. Same payload as GET /cities. */
  @Get('cities')
  @Public()
  @ApiOperation({ summary: 'List cities with malls (legacy path; use GET /cities)' })
  async listCities(@Query('country') country?: string) {
    return this.citiesService.findAll(country);
  }

  // ── Admin mall management ──────────────────────────────────────────────────

  @Get('admin/malls')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS, UserRole.MALL_MANAGER)
  @ApiOperation({ summary: 'Admin: list all malls including inactive' })
  async adminListMalls() {
    return this.stallsService.listAllMalls();
  }

  @Post('admin/malls')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
  @ApiOperation({ summary: 'Admin: create a mall' })
  async createMall(@Body() data: {
    name: string;
    city: string;
    address: string;
    latitude?: number;
    longitude?: number;
    imageUrl?: string;
  }) {
    return this.stallsService.createMall(data);
  }

  @Patch('admin/malls/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
  @ApiOperation({ summary: 'Admin: update a mall' })
  async updateMall(@Param('id') id: string, @Body() data: UpdateMallDto) {
    return this.stallsService.updateMall(id, data);
  }

  @Get('merchant/:merchantId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get stalls by merchant' })
  async getByMerchant(@Param('merchantId') merchantId: string) {
    return this.stallsService.findByMerchant(merchantId);
  }

  @Post(':id/visit')
  @Public()
  @ApiOperation({ summary: 'Record a public storefront view' })
  async recordVisit(@Param('id') id: string) {
    return this.stallsService.recordVisit(id);
  }

  @Post(':id/follow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Follow a stall' })
  async followStall(@Param('id') stallId: string, @CurrentUser('id') userId: string) {
    return this.stallsService.followStall(stallId, userId);
  }

  @Delete(':id/follow')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unfollow a stall' })
  async unfollowStall(@Param('id') stallId: string, @CurrentUser('id') userId: string) {
    return this.stallsService.unfollowStall(stallId, userId);
  }

  @Get(':id/follow-status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get follow status for a stall' })
  async getFollowStatus(@Param('id') stallId: string, @CurrentUser('id') userId: string) {
    return this.stallsService.getFollowStatus(stallId, userId);
  }

  // ── Stall Boost (must come BEFORE :id routes) ─────────────────────────────

  @Get('boost/pricing')
  @Public()
  @ApiOperation({ summary: 'Get stall boost pricing tiers' })
  async getBoostPricing() {
    return this.stallsService.getStallBoostPricing();
  }

  // ── Parameterised routes ──────────────────────────────────────────────────

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get stall by ID' })
  async getById(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return this.stallsService.findById(id, userId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Update stall' })
  async update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() data: UpdateStallDto) {
    return this.stallsService.update(id, userId, data);
  }

  @Get(':id/settings/marketplace')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Get marketplace visibility setting' })
  async getMarketplaceVisibility(@Param('id') stallId: string, @CurrentUser('id') userId: string) {
    return this.stallsService.getMarketplaceVisibility(stallId, userId);
  }

  @Patch(':id/settings/marketplace')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Toggle marketplace visibility for stall products' })
  async updateMarketplaceVisibility(
    @Param('id') stallId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { showOnMarketplace: boolean },
  ) {
    return this.stallsService.updateMarketplaceVisibility(stallId, userId, data.showOnMarketplace);
  }

  @Get(':id/attendants')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
  @ApiOperation({ summary: 'List attendants for a stall' })
  async listAttendants(@Param('id') stallId: string, @CurrentUser('id') userId: string) {
    return this.stallsService.listAttendants(stallId, userId);
  }

  @Post(':id/attendants')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Add attendant to stall' })
  async addAttendant(@Param('id') stallId: string, @Body() data: { userId: string; pin?: string }) {
    return this.stallsService.addAttendant(stallId, data.userId, data.pin);
  }

  @Delete(':id/attendants/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Remove attendant from stall' })
  async removeAttendant(
    @Param('id') stallId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.stallsService.removeAttendant(stallId, targetUserId, userId);
    return { success: true };
  }

  @Get(':id/payment-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT, UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
  @ApiOperation({ summary: 'Get stall merchant payment codes' })
  async getPaymentConfig(@Param('id') stallId: string, @CurrentUser('id') userId: string) {
    return this.stallsService.getPaymentConfig(stallId, userId);
  }

  @Patch(':id/payment-config')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Save stall merchant payment codes (EcoCash / OneMoney)' })
  async savePaymentConfig(
    @Param('id') stallId: string,
    @CurrentUser('id') userId: string,
    @Body() data: UpdatePaymentConfigDto,
  ) {
    return this.stallsService.savePaymentConfig(stallId, userId, data);
  }

  @Post(':id/boost')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Boost (feature) a stall for N days' })
  async boostStall(
    @Param('id') stallId: string,
    @CurrentUser('id') userId: string,
    @Body('days') days: number,
  ) {
    return this.stallsService.boostStall(userId, stallId, Number(days));
  }
}
