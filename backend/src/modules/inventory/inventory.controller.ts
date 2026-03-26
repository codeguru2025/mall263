import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('stall/:stallId')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get inventory for a stall' })
  async getByStall(@Param('stallId') stallId: string) {
    return this.inventoryService.getByStall(stallId);
  }

  @Get('stall/:stallId/low-stock')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get low stock items' })
  async getLowStock(@Param('stallId') stallId: string) {
    return this.inventoryService.getLowStock(stallId);
  }

  @Get('variant/:variantId')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get inventory for a variant' })
  async getByVariant(@Param('variantId') variantId: string) {
    return this.inventoryService.getByVariant(variantId);
  }

  @Post('adjust')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Adjust stock quantity' })
  async adjust(
    @CurrentUser('id') userId: string,
    @Body() data: { variantId: string; changeQty: number; reason: string },
  ) {
    return this.inventoryService.adjustStock(data.variantId, data.changeQty, data.reason, userId);
  }

  @Post('bulk-adjust')
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Bulk adjust stock' })
  async bulkAdjust(
    @CurrentUser('id') userId: string,
    @Body() data: { adjustments: Array<{ variantId: string; quantity: number }> },
  ) {
    return this.inventoryService.bulkAdjust(data.adjustments, userId);
  }

  @Patch('variant/:variantId/threshold')
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Set low stock threshold' })
  async setThreshold(@Param('variantId') variantId: string, @Body() data: { threshold: number }) {
    return this.inventoryService.setLowStockThreshold(variantId, data.threshold);
  }

  @Get('variant/:variantId/logs')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get inventory change logs' })
  async getLogs(
    @Param('variantId') variantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getInventoryLogs(variantId, page, limit);
  }
}
