import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity' })
  async getActivity(@Query('limit') limit?: number) {
    return this.adminService.getRecentActivity(limit);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  async listUsers(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listUsers({ search, limit });
  }

  @Patch('users/:id/role')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Change a user role (super admin only)' })
  async changeUserRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.adminService.changeUserRole(id, role);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user' })
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate a user' })
  async activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  @Patch('stalls/:id/suspend')
  @ApiOperation({ summary: 'Suspend a stall' })
  async suspendStall(@Param('id') id: string) {
    return this.adminService.suspendStall(id);
  }

  @Patch('products/:id/suspend')
  @ApiOperation({ summary: 'Suspend a product' })
  async suspendProduct(@Param('id') id: string) {
    return this.adminService.suspendProduct(id);
  }
}
