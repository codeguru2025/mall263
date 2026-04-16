import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('initiate/web')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate a web (card/Zipit) payment — returns redirectUrl' })
  async initiateWeb(
    @CurrentUser('id') userId: string,
    @Body() data: { amount: number },
  ) {
    return this.paymentsService.initiateWebPayment(userId, data.amount);
  }

  @Post('initiate/mobile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate a mobile money payment (EcoCash / OneMoney / Telecash)' })
  async initiateMobile(
    @CurrentUser('id') userId: string,
    @Body() data: { amount: number; phone: string; method: 'ecocash' | 'onemoney' | 'telecash' },
  ) {
    return this.paymentsService.initiateMobilePayment(
      userId,
      data.amount,
      data.phone,
      data.method,
    );
  }

  @Get('status/:reference')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Poll payment status by reference' })
  async getStatus(@Param('reference') reference: string) {
    return this.paymentsService.pollStatus(reference);
  }

  /**
   * Paynow calls this URL directly — no JWT auth.
   * Body is application/x-www-form-urlencoded (parsed by NestJS urlencoded middleware).
   */
  @Post('webhook')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Paynow payment result webhook (called by Paynow, not the frontend)' })
  async webhook(@Body() body: Record<string, string>) {
    return this.paymentsService.handleWebhook(body);
  }
}
