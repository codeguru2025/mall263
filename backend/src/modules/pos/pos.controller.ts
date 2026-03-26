import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { POSService } from './pos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, PaymentMethod, POSSaleStatus } from '@prisma/client';

@ApiTags('POS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pos')
export class POSController {
  constructor(private posService: POSService) {}

  @Post('sales')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Process a POS sale' })
  async processSale(
    @CurrentUser('id') cashierId: string,
    @Body() data: {
      stallId: string;
      items: Array<{ variantId: string; quantity: number; discount?: number }>;
      paymentMethod: PaymentMethod;
      discountAmount?: number;
      discountType?: string;
      customerPhone?: string;
      notes?: string;
    },
  ) {
    return this.posService.processSale({ ...data, cashierId });
  }

  @Get('sales/stall/:stallId')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get sales for a stall' })
  async getSalesByStall(
    @Param('stallId') stallId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: POSSaleStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.posService.getSalesByStall(stallId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status, page, limit,
    });
  }

  @Get('sales/:id')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get sale details' })
  async getSaleById(@Param('id') id: string) {
    return this.posService.getSaleById(id);
  }

  @Get('summary/stall/:stallId')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get daily sales summary' })
  async getDailySummary(
    @Param('stallId') stallId: string,
    @Query('date') date?: string,
  ) {
    return this.posService.getDailySummary(stallId, date ? new Date(date) : undefined);
  }

  @Post('refunds/:saleId')
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Process a refund' })
  async processRefund(
    @Param('saleId') saleId: string,
    @CurrentUser('id') userId: string,
    @Body() data: { reason: string },
  ) {
    return this.posService.processRefund(saleId, data.reason, userId);
  }
}
