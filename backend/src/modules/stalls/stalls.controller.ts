import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StallsService } from './stalls.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
  @ApiOperation({ summary: 'List all malls' })
  async listMalls(@Query('city') city?: string) {
    return this.stallsService.listMalls(city);
  }

  @Get('merchant/:merchantId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get stalls by merchant' })
  async getByMerchant(@Param('merchantId') merchantId: string) {
    return this.stallsService.findByMerchant(merchantId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get stall by ID' })
  async getById(@Param('id') id: string) {
    return this.stallsService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Update stall' })
  async update(@Param('id') id: string, @CurrentUser() user: any, @Body() data: any) {
    const merchant = await this.stallsService.findById(id);
    return this.stallsService.update(id, merchant.merchantId, data);
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
