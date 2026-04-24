import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  /**
   * Public — list active subscription plans with features.
   * Used by the subscribe modal on the frontend.
   */
  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List active subscription plans' })
  async listPlans() {
    return this.subscriptionsService.listActivePlans();
  }

  /**
   * Public — validate a promo code without consuming it.
   * Used for real-time validation in the subscribe form.
   */
  @Get('promo/validate')
  @Public()
  @ApiOperation({ summary: 'Validate a promo/referral code' })
  async validatePromo(@Query('code') code: string) {
    return this.subscriptionsService.validatePromoCode(code);
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user subscription status' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getStatus(userId);
  }

  @Post('ecocash')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Save EcoCash number and trigger payment if trial expired' })
  async saveEcocash(
    @CurrentUser('id') userId: string,
    @Body() body: { ecocashNumber: string },
  ) {
    return this.subscriptionsService.saveEcocashNumber(userId, body.ecocashNumber);
  }

  @Post('pay')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Manually initiate a subscription payment (optionally with promo code)' })
  async pay(
    @CurrentUser('id') userId: string,
    @Body() body: { promoCode?: string },
  ) {
    return this.subscriptionsService.initiatePayment(userId, undefined, body.promoCode);
  }

  @Get('poll/:reference')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Poll subscription payment status' })
  async poll(
    @Param('reference') reference: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionsService.pollPayment(reference, userId);
  }

  @Post('webhook')
  @Public()
  @Throttle({ default: { limit: 400, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Paynow webhook for subscription payments' })
  async webhook(@Body() body: Record<string, string>) {
    return this.subscriptionsService.handleWebhook(body);
  }
}
