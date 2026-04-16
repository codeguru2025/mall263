import { Controller, Get, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

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
  @ApiOperation({ summary: 'Manually initiate a subscription payment' })
  async pay(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.initiatePayment(userId);
  }

  @Get('poll/:reference')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Poll subscription payment status' })
  async poll(@Param('reference') reference: string) {
    return this.subscriptionsService.pollPayment(reference);
  }

  @Post('webhook')
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Paynow webhook for subscription payments' })
  async webhook(@Body() body: Record<string, string>) {
    return this.subscriptionsService.handleWebhook(body);
  }
}
