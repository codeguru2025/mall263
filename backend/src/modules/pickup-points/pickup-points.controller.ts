import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  PickupPointsService,
  CreatePickupPointDto,
  UpdatePickupPointDto,
} from './pickup-points.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('pickup-points')
@Controller('pickup-points')
export class PickupPointsController {
  constructor(private readonly service: PickupPointsService) {}

  /** Public — customers and drivers see the active list */
  @Get()
  list(@Query('all') all?: string) {
    return this.service.list(all !== 'true');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN, UserRole.MALL_MANAGER)
  create(@Body() dto: CreatePickupPointDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN, UserRole.MALL_MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdatePickupPointDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN, UserRole.MALL_MANAGER)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  /** Pickup point operator scans customer's collection QR — validates and marks collected */
  @Post('collect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  collectScan(@Req() req: Request & { user: any }, @Body() body: { token: string }) {
    return this.service.scanCollectionToken(req.user.id, body.token);
  }
}
