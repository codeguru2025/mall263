import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';
import { RedisService } from '../../redis/redis.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paynow } = require('paynow');

export type PaymentMethod = 'ecocash' | 'onemoney' | 'telecash' | 'omari' | 'web';

interface PendingPayment {
  userId: string;
  amount: number;
  pollUrl: string;
  method: PaymentMethod;
  credited?: boolean; // set to true by creditWallet so pollStatus can detect webhook-credited payments
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private paynow: any;
  private merchantEmail: string;

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
    this.merchantEmail = this.config.get('PAYNOW_MERCHANT_EMAIL', '');
    if (!this.merchantEmail) {
      this.logger.warn('PAYNOW_MERCHANT_EMAIL is not set — payments will fail');
    }
  }

  /**
   * Initiate a web (card / Zipit) payment.
   * Returns a redirectUrl — frontend redirects the user there.
   * Paynow calls the resultUrl webhook on completion.
   */
  async initiateWebPayment(userId: string, amount: number) {
    if (amount < 1) throw new BadRequestException('Minimum deposit is $1.00');

    const reference = `M263-${userId.slice(0, 8)}-${Date.now()}`;
    const payment = this.paynow.createPayment(reference, this.merchantEmail);
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
    phone: string,
    method: 'ecocash' | 'onemoney' | 'telecash' | 'omari',
  ) {
    if (amount < 1) throw new BadRequestException('Minimum deposit is $1.00');

    const normalised = this.normalisePhone(phone);
    const reference = `M263-${userId.slice(0, 8)}-${Date.now()}`;
    const payment = this.paynow.createPayment(reference, this.merchantEmail);
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
      this.logger.warn(
        `Webhook for unknown or expired reference: ${reference} — pending key missing (TTL expired or Redis loss). ` +
          `If status is PAID, reconcile via Paynow and credit manually using external_ref=${reference} if needed.`,
      );
      return { ok: true, credited: false };
    }

    await this.creditWallet(pending, reference);
    return { ok: true, credited: true };
  }

  /**
   * Frontend polls this to know when a mobile payment has been approved.
   * Returns { paid, status } — frontend stops polling when paid === true.
   * userId is required to ensure callers can only poll their own payments.
   */
  async pollStatus(reference: string, userId: string) {
    if (await this.walletService.hasCompletedDepositByExternalRef(reference)) {
      return { paid: true, status: 'PAID' };
    }

    const pending = await this.getPending(reference);

    // Key was already deleted or is missing entirely
    if (!pending) return { paid: false, status: 'NOT_FOUND' };

    // Prevent cross-user status probing
    if (pending.userId !== userId) return { paid: false, status: 'NOT_FOUND' };

    // Webhook already credited the wallet — tell the frontend immediately
    if (pending.credited) return { paid: true, status: 'PAID' };

    let statusResponse: any;
    try {
      statusResponse = await this.paynow.pollTransaction(pending.pollUrl);
    } catch (err) {
      this.logger.error(`Poll failed for ${reference}`, err);
      return { paid: false, status: 'POLL_ERROR' };
    }

    // paynow.pollTransaction() returns InitResponse: there is no `paid` field.
    // Completed payments report status "paid" (lowercased by the library).
    const st = String(statusResponse?.status ?? '').toLowerCase();
    const paid =
      statusResponse?.paid === true ||
      (typeof statusResponse?.paid === 'function' && statusResponse.paid() === true) ||
      st === 'paid';

    const terminalFail = ['cancelled', 'canceled', 'failed', 'disputed', 'refunded'].includes(st);
    const statusOut = String(statusResponse?.status || 'UNKNOWN').toUpperCase();

    if (terminalFail) {
      return { paid: false, status: statusOut };
    }

    if (paid) {
      await this.creditWallet(pending, reference);
      return { paid: true, status: 'PAID' };
    }

    return { paid: false, status: statusOut };
  }

  /**
   * Fire a USSD push to a customer's phone for a POS merchant-code payment.
   * Unlike initiateMobilePayment(), this does NOT credit a Mall263 wallet.
   * The caller is responsible for storing the pollUrl and finalizing the sale.
   */
  async initiateUssdPush(
    amount: number,
    customerPhone: string,
    method: 'ecocash' | 'onemoney',
    reference: string,
  ): Promise<{ pollUrl: string; instructions: string }> {
    const normalised = this.normalisePhone(customerPhone);
    const payment = this.paynow.createPayment(reference, this.merchantEmail);
    payment.add('POS Payment — Mall263', amount);

    let response: any;
    try {
      response = await this.paynow.sendMobile(payment, normalised, method);
    } catch (err) {
      this.logger.error('Paynow USSD push failed', err);
      throw new BadRequestException('Payment gateway unavailable. Please try again.');
    }

    if (!response.success) {
      throw new BadRequestException(
        `Payment initiation failed: ${response.error || 'unknown error'}`,
      );
    }

    return {
      pollUrl: response.pollUrl,
      instructions:
        response.instructions ||
        `A payment prompt has been sent to ${customerPhone}. The customer should enter their ${method === 'ecocash' ? 'EcoCash' : 'OneMoney'} PIN to approve.`,
    };
  }

  /** Poll a Paynow transaction by pollUrl (no wallet side-effects). */
  async pollUssdStatus(pollUrl: string): Promise<{ paid: boolean; status: string }> {
    let statusResponse: any;
    try {
      statusResponse = await this.paynow.pollTransaction(pollUrl);
    } catch (err) {
      this.logger.error('USSD poll failed', err);
      return { paid: false, status: 'POLL_ERROR' };
    }

    const st = String(statusResponse?.status ?? '').toLowerCase();
    const paid =
      statusResponse?.paid === true ||
      (typeof statusResponse?.paid === 'function' && statusResponse.paid() === true) ||
      st === 'paid';
    const terminalFail = ['cancelled', 'canceled', 'failed', 'disputed', 'refunded'].includes(st);

    return {
      paid,
      status: terminalFail
        ? 'FAILED'
        : paid
          ? 'PAID'
          : String(statusResponse?.status || 'PENDING').toUpperCase(),
    };
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
      // Mark as credited (don't delete) so concurrent polls can still detect success.
      // Deleting immediately causes a race: webhook credits then poll returns NOT_FOUND
      // and the frontend gets stuck in the loading state even though the wallet was funded.
      await this.redis.getClient().set(
        `paynow:pending:${reference}`,
        JSON.stringify({ ...pending, credited: true }),
        'EX',
        7200, // 2h after credit so late polls / flaky clients still see PAID
      );
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
      86_400, // 24h — mobile-money approvals can be slow; avoids webhook arriving after key expiry
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
