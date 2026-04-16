import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StallsService } from './stalls.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Stalls')
@Controller('stalls')
export class StallsController {
  constructor(private stallsService: StallsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.FIELD_AGENT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a stall' })
  async create(@Body() data: any) {
    return this.stallsService.create(data);
  }

  @Get('malls')
  @Public()
  @ApiOperation({ summary: 'List active malls (public)' })
  async listMalls(@Query('city') city?: string) {
    return this.stallsService.listMalls(city);
  }

  // ── Admin mall management ──────────────────────────────────────────────────

  @Get('admin/malls')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
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
  async updateMall(@Param('id') id: string, @Body() data: any) {
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
  async update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() data: any) {
    return this.stallsService.update(id, userId, data);
  }

  @Post(':id/attendants')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Add attendant to stall' })
  async addAttendant(@Param('id') stallId: string, @Body() data: { userId: string; pin?: string }) {
    return this.stallsService.addAttendant(stallId, data.userId, data.pin);
  }
}
