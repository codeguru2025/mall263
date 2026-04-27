import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, PromoType, AdPlacement } from '@prisma/client';

/** Platform operators only: user lifecycle, app config, catalog/pricing, ads/promos. */
const R_CORE: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN_OPS];
/** All staff admin consoles: overview, read lists, support actions. */
const R_STAFF: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_OPS,
  UserRole.FINANCE_ADMIN,
  UserRole.SUPPORT_ADMIN,
];
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Roles(...R_STAFF)
  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Roles(...R_STAFF)
  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity' })
  async getActivity(@Query('limit') limitStr?: string) {
    const limit = limitStr !== undefined ? Math.max(1, Math.min(100, parseInt(limitStr, 10) || 20)) : undefined;
    return this.adminService.getRecentActivity(limit);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  @Roles(...R_CORE)
  @Post('users')
  @ApiOperation({ summary: 'Admin: create a user account' })
  async createUser(
    @CurrentUser('id') actorId: string,
    @Body() body: {
      firstName: string;
      lastName: string;
      phone: string;
      password: string;
      role: UserRole;
    },
  ) {
    return this.adminService.createUser(actorId, body);
  }

  @Roles(...R_STAFF)
  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  async listUsers(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listUsers({ search, page, limit });
  }

  @Roles(...R_STAFF)
  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a user (name, phone, avatar, optional password)' })
  async updateUser(
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Param('id') id: string,
    @Body() body: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatarUrl?: string | null;
      phoneVerified?: boolean;
      password?: string;
    },
  ) {
    return this.adminService.updateUser(actorId, actorRole, id, body);
  }

  @Roles(...R_CORE)
  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate a user and revoke sessions (soft delete)' })
  async deleteUser(@CurrentUser('id') actorId: string, @CurrentUser('role') actorRole: UserRole, @Param('id') id: string) {
    return this.adminService.softDeleteUser(actorId, actorRole, id);
  }

  @Roles(...R_CORE)
  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change a user role (super admin role requires super admin)' })
  async changeUserRole(
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ) {
    return this.adminService.changeUserRole(actorId, actorRole, id, role);
  }

  @Roles(...R_STAFF)
  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user' })
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Roles(...R_STAFF)
  @Patch('users/:id/activate')
  @ApiOperation({ summary: 'Activate a user' })
  async activateUser(@Param('id') id: string) {
    return this.adminService.activateUser(id);
  }

  // ── Stalls ────────────────────────────────────────────────────────────────

  @Roles(...R_STAFF)
  @Get('stalls')
  @ApiOperation({ summary: 'List all stalls (admin)' })
  async listStalls(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.listStalls({ search, page, limit });
  }

  @Roles(...R_STAFF)
  @Patch('stalls/:id/suspend')
  @ApiOperation({ summary: 'Suspend a stall' })
  async suspendStall(@Param('id') id: string) {
    return this.adminService.suspendStall(id);
  }

  @Roles(...R_STAFF)
  @Patch('stalls/:id/activate')
  @ApiOperation({ summary: 'Reactivate a suspended stall' })
  async activateStall(@Param('id') id: string) {
    return this.adminService.activateStall(id);
  }

  @Roles(...R_STAFF)
  @Patch('stalls/:id/approve')
  @ApiOperation({ summary: 'Approve a pending stall (set to ACTIVE)' })
  async approveStall(@Param('id') id: string) {
    return this.adminService.activateStall(id);
  }

  @Roles(...R_CORE)
  @Patch('stalls/:id/location')
  @ApiOperation({ summary: 'Admin: set stall GPS coordinates' })
  async updateStallLocation(@Param('id') id: string, @Body() body: { latitude: number; longitude: number }) {
    return this.adminService.updateStallLocation(id, body.latitude, body.longitude);
  }

  @Roles(...R_STAFF)
  @Patch('products/:id/suspend')
  @ApiOperation({ summary: 'Suspend a product' })
  async suspendProduct(@Param('id') id: string) {
    return this.adminService.suspendProduct(id);
  }

  // ── Categories ────────────────────────────────────────────────────────────

  @Roles(...R_STAFF)
  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  async listCategories() {
    return this.adminService.listCategories();
  }

  @Roles(...R_CORE)
  @Post('categories')
  @ApiOperation({ summary: 'Create a new category' })
  async createCategory(@Body() data: { name: string; parentId?: string; imageUrl?: string }) {
    return this.adminService.createCategory(data);
  }

  @Roles(...R_CORE)
  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  async updateCategory(
    @Param('id') id: string,
    @Body() data: { name?: string; parentId?: string; imageUrl?: string; sortOrder?: number; isActive?: boolean },
  ) {
    return this.adminService.updateCategory(id, data);
  }

  @Roles(...R_CORE)
  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category' })
  async deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  // ── App Settings ──────────────────────────────────────────────────────────

  @Roles(...R_STAFF)
  @Get('settings')
  @ApiOperation({ summary: 'Get all app settings' })
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Roles(...R_CORE)
  @Post('settings/:key')
  @ApiOperation({ summary: 'Set an app setting value' })
  async setSetting(@Param('key') key: string, @Body('value') value: string) {
    return this.adminService.setSetting(key, value);
  }

  // ── Subscription Management ───────────────────────────────────────────────

  @Roles(...R_STAFF)
  @Get('subscriptions')
  @ApiOperation({ summary: 'List all user subscriptions with status and summary counts' })
  async listSubscriptions(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.listSubscriptions({ status: status as any, page, limit, search });
  }

  @Roles(...R_STAFF)
  @Patch('subscriptions/:userId/extend-trial')
  @ApiOperation({ summary: 'Extend the trial period for a user by N days' })
  async extendTrial(@Param('userId') userId: string, @Body('days') days: number) {
    return this.adminService.extendTrial(userId, days ?? 7);
  }

  @Roles(...R_STAFF)
  @Patch('subscriptions/:userId/grant-month')
  @ApiOperation({ summary: 'Grant a user 1 free month of active subscription' })
  async grantFreeMonth(@Param('userId') userId: string) {
    return this.adminService.grantFreeMonth(userId);
  }

  // ── Subscription Plans ────────────────────────────────────────────────────

  @Roles(...R_STAFF)
  @Get('subscription-plans')
  @ApiOperation({ summary: 'List all subscription plans' })
  async listSubscriptionPlans() {
    return this.adminService.listSubscriptionPlans();
  }

  @Roles(...R_CORE)
  @Post('subscription-plans')
  @ApiOperation({ summary: 'Create a subscription plan' })
  async createSubscriptionPlan(
    @Body() data: {
      name: string;
      slug: string;
      priceUsd: number;
      trialDays?: number;
      description?: string;
      features?: string[];
      isActive?: boolean;
      isDefault?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.adminService.createSubscriptionPlan(data);
  }

  @Roles(...R_CORE)
  @Patch('subscription-plans/:id')
  @ApiOperation({ summary: 'Update a subscription plan' })
  async updateSubscriptionPlan(
    @Param('id') id: string,
    @Body() data: {
      name?: string;
      slug?: string;
      priceUsd?: number;
      trialDays?: number;
      description?: string;
      features?: string[];
      isActive?: boolean;
      isDefault?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.adminService.updateSubscriptionPlan(id, data);
  }

  @Roles(...R_CORE)
  @Delete('subscription-plans/:id')
  @ApiOperation({ summary: 'Delete a subscription plan' })
  async deleteSubscriptionPlan(@Param('id') id: string) {
    return this.adminService.deleteSubscriptionPlan(id);
  }

  // ── Promotions ────────────────────────────────────────────────────────────

  @Roles(...R_STAFF)
  @Get('promotions')
  @ApiOperation({ summary: 'List all promotions / referral codes' })
  async listPromotions() {
    return this.adminService.listPromotions();
  }

  @Roles(...R_CORE)
  @Post('promotions')
  @ApiOperation({ summary: 'Create a promotion / referral code' })
  async createPromotion(
    @CurrentUser('id') adminId: string,
    @Body() data: {
      code: string;
      type: PromoType;
      discountPct?: number;
      discountAmt?: number;
      maxUses?: number;
      validFrom: string;
      validUntil?: string;
      description?: string;
    },
  ) {
    return this.adminService.createPromotion(adminId, data);
  }

  @Roles(...R_CORE)
  @Patch('promotions/:id')
  @ApiOperation({ summary: 'Update a promotion' })
  async updatePromotion(
    @Param('id') id: string,
    @Body() data: {
      isActive?: boolean;
      maxUses?: number;
      validUntil?: string;
      description?: string;
      discountPct?: number;
      discountAmt?: number;
    },
  ) {
    return this.adminService.updatePromotion(id, data);
  }

  @Roles(...R_CORE)
  @Delete('promotions/:id')
  @ApiOperation({ summary: 'Delete a promotion' })
  async deletePromotion(@Param('id') id: string) {
    return this.adminService.deletePromotion(id);
  }

  // ── Ads ───────────────────────────────────────────────────────────────────

  @Roles(...R_STAFF)
  @Get('ads')
  @ApiOperation({ summary: 'List all ads (admin view, includes inactive)' })
  async listAds() {
    return this.adminService.listAds();
  }

  @Roles(...R_CORE)
  @Post('ads')
  @ApiOperation({ summary: 'Create an ad' })
  async createAd(
    @CurrentUser('id') adminId: string,
    @Body() data: {
      title: string;
      imageUrl?: string;
      linkUrl?: string;
      placement: AdPlacement;
      targetRole?: string;
      startsAt: string;
      endsAt?: string;
    },
  ) {
    return this.adminService.createAd(adminId, data);
  }

  @Roles(...R_CORE)
  @Patch('ads/:id')
  @ApiOperation({ summary: 'Update an ad' })
  async updateAd(
    @Param('id') id: string,
    @Body() data: {
      title?: string;
      imageUrl?: string;
      linkUrl?: string;
      placement?: AdPlacement;
      targetRole?: string;
      isActive?: boolean;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    return this.adminService.updateAd(id, data);
  }

  @Roles(...R_CORE)
  @Delete('ads/:id')
  @ApiOperation({ summary: 'Delete an ad' })
  async deleteAd(@Param('id') id: string) {
    return this.adminService.deleteAd(id);
  }
}

// ── Public ads endpoint (separate controller to avoid auth guard) ─────────────
import { Controller as NestController } from '@nestjs/common';

@ApiTags('Ads')
@NestController('ads')
export class AdsPublicController {
  constructor(private adminService: AdminService) {}

  @Get('active')
  @Public()
  @ApiOperation({ summary: 'Get active ads for the current user role and placement' })
  async getActiveAds(@Query('role') role?: string, @Query('placement') placement?: string) {
    return this.adminService.listActiveAds(role, placement);
  }

  @Post(':id/impression')
  @Public()
  @ApiOperation({ summary: 'Record an ad impression' })
  async recordImpression(@Param('id') id: string) {
    return this.adminService.recordAdImpression(id);
  }
}

// ── Public settings endpoint (delivery rate etc) ───────────────────────────
@ApiTags('Settings')
@NestController('settings')
export class PublicSettingsController {
  constructor(private adminService: AdminService) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get public app settings (delivery rate)' })
  async getPublicSettings() {
    const all = await this.adminService.getSettings();
    // Only expose safe public keys
    return { delivery_rate_per_km: all.delivery_rate_per_km ?? '0.50' };
  }
}
