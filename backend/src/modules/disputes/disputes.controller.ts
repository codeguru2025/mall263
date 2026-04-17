import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DisputeStatus, UserRole } from '@prisma/client';

@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private disputes: DisputesService) {}

  @Post(':jobId')
  @ApiOperation({ summary: 'Open a dispute for a delivery job' })
  openDispute(
    @Param('jobId') jobId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { reason: string; evidence?: any },
  ) {
    return this.disputes.openDispute(jobId, userId, body.reason, body.evidence);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my disputes' })
  getMyDisputes(@CurrentUser('id') userId: string) {
    return this.disputes.getMyDisputes(userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN)
  @ApiOperation({ summary: 'List all disputes (admin)' })
  getAll(@Query('status') status?: DisputeStatus) {
    return this.disputes.getAll(status);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN)
  @ApiOperation({ summary: 'Update dispute status (admin)' })
  updateStatus(@Param('id') id: string, @Body() body: { status: DisputeStatus }) {
    return this.disputes.updateStatus(id, body.status);
  }

  @Post(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN_OPS, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Resolve a dispute (admin)' })
  resolve(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() body: { outcome: DisputeStatus; resolution: string },
  ) {
    return this.disputes.resolveDispute(id, adminId, body.outcome, body.resolution);
  }
}
