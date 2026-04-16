import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, SupportRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SupportRequestsService } from './support-requests.service';
import { UpdateSupportRequestDto } from './dto/update-support-request.dto';

@ApiTags('Support (Admin)')
@ApiBearerAuth()
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS, UserRole.SUPPORT_ADMIN)
@Controller('admin/support-requests')
export class SupportRequestsAdminController {
  constructor(private supportRequests: SupportRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'List support / help requests' })
  async list(@Query('status') status?: SupportRequestStatus, @Query('limit') limit?: number) {
    return this.supportRequests.listForAdmin({ status, limit });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update status, notes, or assignee' })
  async update(@Param('id') id: string, @Body() dto: UpdateSupportRequestDto) {
    return this.supportRequests.updateForAdmin(id, dto);
  }
}
