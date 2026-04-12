import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExpenseCategory, UserRole } from '@prisma/client';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Get('stall/:stallId')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'List stall operating expenses (date filter optional)' })
  async list(
    @Param('stallId') stallId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: ExpenseCategory,
    @Query('limit') limit?: number,
  ) {
    return this.expensesService.list(stallId, userId, userRole, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      category,
      limit: limit != null ? Number(limit) : undefined,
    });
  }

  @Post('stall/:stallId')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Record an expense (salary, transport, meals, rent, etc.)' })
  async create(
    @Param('stallId') stallId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body()
    data: {
      category: ExpenseCategory;
      amount: number;
      currency?: string;
      description?: string;
      occurredAt: string;
    },
  ) {
    return this.expensesService.create(stallId, userId, userRole, data);
  }

  @Patch(':id')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Update an expense' })
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body()
    data: Partial<{
      category: ExpenseCategory;
      amount: number;
      currency: string;
      description: string | null;
      occurredAt: string;
    }>,
  ) {
    return this.expensesService.update(id, userId, userRole, data);
  }

  @Delete(':id')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Delete an expense' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.expensesService.remove(id, userId, userRole);
  }
}
