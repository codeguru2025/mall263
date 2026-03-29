import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';
import { RedisService } from '../../redis/redis.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paynow } = require('paynow');

export type PaymentMethod = 'ecocash' | 'onemoney' | 'telecash' | 'web';

interface PendingPayment {
  userId: string;
  amount: number;
  email: string;
  pollUrl: string;
  method: PaymentMethod;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private paynow: any;

  constructor(
    private config: ConfigService,
    private walletService: WalletService,
    private redis: RedisService,
  ) {
    const integrationId = this.config.get('PAYNOW_INTEGRATION_ID');
    const integrationKey = this.config.get('PAYNOW_INTEGRATION_KEY');
    this.paynow = new Paynow(integrationId, integrationKey);
    this.paynow.resultUrl = this.config.get('PAYNOW_RESULT_URL'); // backend webhook
    this.paynow.returnUrl = this.config.get('PAYNOW_RETURN_URL'); // frontend return page
  }

  /**
   * Initiate a web (card / Zipit) payment.
   * Returns a redirectUrl — frontend redirects the user there.
   * Paynow calls the resultUrl webhook on completion.
   */
  async initiateWebPayment(userId: string, amount: number, email: string) {
    if (amount < 1) throw new BadRequestException('Minimum deposit is $1.00');

    const reference = `M263-${userId.slice(0, 8)}-${Date.now()}`;
    const payment = this.paynow.createPayment(reference, email);
    payment.add('Wallet Deposit — Mall263', amount);

    let response: any;
    try {
      response = await this.paynow.send(payment);
    } catch (err) {
      this.logger.error('Paynow initiation failed', err);
      throw new BadRequestException('Payment gateway unavailable. Please try again.');
    }

    if (!response.success) {
      throw new BadRequestException(`Payment initiation failed: ${response.error || 'unknown error'}`);
    }

    // Store pending payment in Redis for 2 hours
    await this.storePending(reference, {
      userId,
      amount,
      email,
      pollUrl: response.pollUrl,
      method: 'web',
    });

    return { reference, redirectUrl: response.redirectUrl, pollUrl: response.pollUrl };
  }

  /**
   * Initiate a mobile money payment (EcoCash / OneMoney / Telecash).
   * User receives a USSD push on their phone — no redirect needed.
   * Frontend polls GET /payments/status/:reference for confirmation.
   */
  async initiateMobilePayment(
    userId: string,
    amount: number,
    email: string,
    phone: string,
    method: 'ecocash' | 'onemoney' | 'telecash',
  ) {
    if (amount < 1) throw new BadRequestException('Minimum deposit is $1.00');

    const normalised = this.normalisePhone(phone);
    const reference = `M263-${userId.slice(0, 8)}-${Date.now()}`;
    const payment = this.paynow.createPayment(reference, email);
    payment.add('Wallet Deposit — Mall263', amount);

    let response: any;
    try {
      response = await this.paynow.sendMobile(payment, normalised, method);
    } catch (err) {
      this.logger.error('Paynow mobile initiation failed', err);
      throw new BadRequestException('Payment gateway unavailable. Please try again.');
    }

    if (!response.success) {
      throw new BadRequestException(`Payment initiation failed: ${response.error || 'unknown error'}`);
    }

    await this.storePending(reference, {
      userId,
      amount,
      email,
      pollUrl: response.pollUrl,
      method,
    });

    return {
      reference,
      pollUrl: response.pollUrl,
      instructions: response.instructions || `Check your phone for the ${method.toUpperCase()} payment prompt and enter your PIN.`,
    };
  }

  /**
   * Paynow calls this webhook (POST resultUrl) when a payment status changes.
   * Paynow may call this multiple times — deposit() is idempotent via externalRef.
   */
  async handleWebhook(body: Record<string, string>) {
    // Verify Paynow hash signature
    if (!this.paynow.verifyHash(body)) {
      this.logger.warn('Webhook received with invalid hash — ignoring');
      return { ok: false };
    }

    const reference = body.reference;
    const status = (body.status || '').toLowerCase();

    this.logger.log(`Paynow webhook: ref=${reference} status=${status}`);

    if (status !== 'paid') return { ok: true, credited: false };

    const pending = await this.getPending(reference);
    if (!pending) {
      this.logger.warn(`Webhook for unknown reference: ${reference}`);
      return { ok: true, credited: false };
    }

    await this.creditWallet(pending, reference);
    return { ok: true, credited: true };
  }

  /**
   * Frontend polls this to know when a mobile payment has been approved.
   * Returns { paid, status } — frontend stops polling when paid === true.
   */
  async pollStatus(reference: string) {
    const pending = await this.getPending(reference);
    if (!pending) return { paid: false, status: 'NOT_FOUND' };

    let statusResponse: any;
    try {
      statusResponse = await this.paynow.pollTransaction(pending.pollUrl);
    } catch (err) {
      this.logger.error(`Poll failed for ${reference}`, err);
      return { paid: false, status: 'POLL_ERROR' };
    }

    const paid = statusResponse.paid();
    const status: string = statusResponse.status || 'UNKNOWN';

    if (paid) {
      await this.creditWallet(pending, reference);
    }

    return { paid, status: status.toUpperCase() };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async creditWallet(pending: PendingPayment, reference: string) {
    try {
      const result = await this.walletService.deposit(
        pending.userId,
        pending.amount,
        reference,
        `Paynow deposit via ${pending.method.toUpperCase()} — ref ${reference}`,
      );
      if (!result.idempotent) {
        this.logger.log(`Wallet credited $${pending.amount} for user ${pending.userId} ref ${reference}`);
      }
      // Clean up Redis after crediting
      await this.redis.getClient().del(`paynow:pending:${reference}`);
    } catch (err) {
      this.logger.error(`Failed to credit wallet for ref ${reference}`, err);
      throw err;
    }
  }

  private async storePending(reference: string, data: PendingPayment) {
    await this.redis.getClient().set(
      `paynow:pending:${reference}`,
      JSON.stringify(data),
      'EX',
      7200, // 2 hours
    );
  }

  private async getPending(reference: string): Promise<PendingPayment | null> {
    const raw = await this.redis.getClient().get(`paynow:pending:${reference}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Normalise Zimbabwean phone to international format for Paynow */
  private normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('263')) return `+${digits}`;
    if (digits.startsWith('0')) return `+263${digits.slice(1)}`;
    return `+263${digits}`;
  }
}
