import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CodService } from './cod.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('COD')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cod')
export class CodController {
  constructor(private cod: CodService) {}

  @Get('my-liability')
  @ApiOperation({ summary: 'Get my current COD cash liability' })
  async getMyLiability(@CurrentUser('id') userId: string) {
    return this.cod.getMyLiability(userId);
  }

  @Post(':jobId/confirm-collected')
  @ApiOperation({ summary: 'Driver confirms cash collected from buyer' })
  async confirmCollected(
    @Param('jobId') jobId: string,
    @CurrentUser('id') userId: string,
  ) {
    const prisma = this.cod['prisma'] as any;
    const driver = await prisma.driver.findUnique({ where: { userId } });
    return this.cod.confirmCashCollected(jobId, driver?.id ?? '');
  }

  @Post(':jobId/remit')
  @ApiOperation({ summary: 'Driver remits cash to the system' })
  async remit(
    @Param('jobId') jobId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { remittanceRef: string },
  ) {
    const prisma = this.cod['prisma'] as any;
    const driver = await prisma.driver.findUnique({ where: { userId } });
    return this.cod.remitCash(jobId, driver?.id ?? '', body.remittanceRef);
  }

  @Post('flag-overdue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN, UserRole.FINANCE_ADMIN)
  @ApiOperation({ summary: 'Flag overdue COD transactions (admin)' })
  async flagOverdue(@Body() body: { hours?: number }) {
    return this.cod.flagOverdue(body.hours ?? 24);
  }
}
