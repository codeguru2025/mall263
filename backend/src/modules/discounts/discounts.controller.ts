import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('discounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  create(@Body() createDiscountDto: CreateDiscountDto, @CurrentUser('id') userId: string) {
    return this.discountsService.create(createDiscountDto.stallId, createDiscountDto, userId);
  }

  @Get()
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  findAll(@Query('stallId') stallId: string, @Query('includeInactive') includeInactive?: string) {
    return this.discountsService.findAll(stallId, includeInactive === 'true');
  }

  @Get('stats/:stallId')
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  getStats(@Param('stallId') stallId: string) {
    return this.discountsService.getDiscountStats(stallId);
  }

  @Get(':id')
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  findOne(@Param('id') id: string, @Query('stallId') stallId?: string) {
    return this.discountsService.findOne(id, stallId);
  }

  @Post('validate')
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS, UserRole.ATTENDANT)
  validateDiscount(@Body() applyDiscountDto: ApplyDiscountDto) {
    return this.discountsService.validateAndCalculateDiscount(applyDiscountDto.stallId, applyDiscountDto);
  }

  @Patch(':id')
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  update(@Param('id') id: string, @Body() updateDiscountDto: UpdateDiscountDto, @CurrentUser('id') userId: string) {
    return this.discountsService.update(id, updateDiscountDto, userId);
  }

  @Delete(':id')
  @Roles(UserRole.STALL_OWNER, UserRole.ADMIN_OPS)
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.discountsService.remove(id, userId);
  }
}
