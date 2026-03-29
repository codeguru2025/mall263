import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WalletTransactionType } from '@prisma/client';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my wallet details' })
  async getMyWallet(@CurrentUser('id') userId: string) {
    return this.walletService.getWallet(userId);
  }

  @Get('me/balance')
  @ApiOperation({ summary: 'Get my wallet balance' })
  async getBalance(@CurrentUser('id') userId: string) {
    return this.walletService.getBalance(userId);
  }

  @Get('me/buying-power')
  @ApiOperation({ summary: 'Get my buying power tier' })
  async getBuyingPower(@CurrentUser('id') userId: string) {
    return this.walletService.getBuyingPowerTier(userId);
  }

  @Post('me/deposit')
  @ApiOperation({ summary: 'Deposit funds (simulated — in production, triggered by payment gateway)' })
  async deposit(
    @CurrentUser('id') userId: string,
    @Body() data: { amount: number; externalRef?: string; description?: string },
  ) {
    return this.walletService.deposit(userId, data.amount, data.externalRef, data.description);
  }

  @Post('me/withdraw')
  @ApiOperation({ summary: 'Request withdrawal' })
  async withdraw(
    @CurrentUser('id') userId: string,
    @Body() data: { amount: number; description?: string },
  ) {
    return this.walletService.requestWithdrawal(userId, data.amount, data.description);
  }

  @Get('me/transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query('type') type?: WalletTransactionType,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.walletService.getTransactions(userId, { type, page, limit });
  }

  @Post('me/check-bid')
  @ApiOperation({ summary: 'Check if I can place a bid (10% rule)' })
  async checkBid(
    @CurrentUser('id') userId: string,
    @Body() data: { targetAmount: number },
  ) {
    return this.walletService.canPlaceBid(userId, data.targetAmount);
  }

  @Get('me/commission-check')
  @ApiOperation({ summary: 'Check commission balance for a sale amount (seller)' })
  async checkCommission(
    @CurrentUser('id') userId: string,
    @Query('saleAmount') saleAmount: string,
  ) {
    return this.walletService.checkCommissionBalance(userId, parseFloat(saleAmount));
  }

  @Patch('transactions/:id/complete')
  @ApiOperation({ summary: 'Mark a pending withdrawal as completed (payment processor webhook)' })
  async completeWithdrawal(
    @Param('id') id: string,
    @Body() data: { externalRef?: string },
  ) {
    return this.walletService.completeWithdrawal(id, data.externalRef);
  }

  @Patch('transactions/:id/fail')
  @ApiOperation({ summary: 'Reverse a failed withdrawal — returns funds to wallet (payment processor webhook)' })
  async failWithdrawal(
    @Param('id') id: string,
    @Body() data: { reason: string },
  ) {
    return this.walletService.failWithdrawal(id, data.reason);
  }
}
