import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { MallsService } from './malls.service';
import { CreateMallDto } from './dto/create-mall.dto';
import { UpdateMallDto } from './dto/update-mall.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('malls')
export class MallsController {
  constructor(private readonly mallsService: MallsService) {}

  // ── Public read endpoints (needed for dropdowns) ──────────────────────────

  @Get()
  findAll(@Query('cityId') cityId?: string, @Query('includeInactive') includeInactive?: string) {
    return this.mallsService.findAll(cityId, includeInactive === 'true');
  }

  // ── Admin-only: creation logs (must come BEFORE :id to avoid route shadowing) ──

  @Get('logs/creation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
  getCreationLogs(@Query('mallId') mallId?: string) {
    return this.mallsService.getCreationLogs(mallId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mallsService.findOne(id);
  }

  // ── Admin-only mutations ──────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS, UserRole.MALL_MANAGER)
  create(@Body() createMallDto: CreateMallDto) {
    return this.mallsService.create(createMallDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS, UserRole.MALL_MANAGER)
  update(@Param('id') id: string, @Body() updateMallDto: UpdateMallDto) {
    return this.mallsService.update(id, updateMallDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
  remove(@Param('id') id: string) {
    return this.mallsService.remove(id);
  }
}
