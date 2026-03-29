import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('stall/:stallId')
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Get stall sales report' })
  async getStallReport(
    @Param('stallId') stallId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO 8601 (e.g. 2024-01-01)');
    }
    return this.reportsService.getStallReport(stallId, start, end);
  }

  @Get('platform')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS, UserRole.FINANCE_ADMIN)
  @ApiOperation({ summary: 'Get platform-wide report (admin)' })
  async getPlatformReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO 8601 (e.g. 2024-01-01)');
    }
    return this.reportsService.getPlatformReport(start, end);
  }
}
