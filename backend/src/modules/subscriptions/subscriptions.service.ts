import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, SubscriptionStatus } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paynow } = require('paynow');

const SUBSCRIPTION_PRICE_USD = 5;
const TRIAL_DAYS = 7;
const GRACE_DAYS = 3; // days after failed payment before full lockout
const RETRY_INTERVAL_MINUTES = 30;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private paynow: any;
  private merchantEmail: string;
  private resultUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const integrationId = this.config.get('PAYNOW_INTEGRATION_ID');
    const integrationKey = this.config.get('PAYNOW_INTEGRATION_KEY');
    this.paynow = new Paynow(integrationId, integrationKey);
    this.merchantEmail = this.config.get('PAYNOW_MERCHANT_EMAIL', '');
    this.resultUrl = this.config.get('PAYNOW_SUBSCRIPTION_RESULT_URL',
      `${this.config.get('PAYNOW_RESULT_URL', '').replace('/payments/webhook', '')}/subscriptions/webhook`);
    this.paynow.resultUrl = this.resultUrl;
    this.paynow.returnUrl = this.config.get('PAYNOW_RETURN_URL', '');
  }

  /**
   * Called during user registration to start a 7-day free trial.
   */
  async initTrial(userId: string): Promise<void> {
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt,
      },
      update: {},
    });
  }

  /**
   * Get subscription status for a user. Creates TRIAL if missing (edge case for seeded users).
   */
  async getStatus(userId: string) {
    let sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) {
      // Backfill for existing users — treat as if trial just started
      await this.initTrial(userId);
      sub = await this.prisma.subscription.findUnique({ where: { userId } });
    }

    const now = new Date();
    const trialActive = sub!.status === SubscriptionStatus.TRIAL && sub!.trialEndsAt > now;
    const isActive = sub!.status === SubscriptionStatus.ACTIVE;
    const isGrace = sub!.status === SubscriptionStatus.GRACE;
    const fullyAccess = trialActive || isActive || isGrace;

    return {
      status: sub!.status,
      trialEndsAt: sub!.trialEndsAt,
      trialActive,
      isActive,
      fullyAccess,           // can use all features
      hasEcocash: !!sub!.ecocashNumber,
      ecocashNumber: sub!.ecocashNumber ? this.maskPhone(sub!.ecocashNumber) : null,
      currentPeriodEnd: sub!.currentPeriodEnd,
      nextBillingDate: sub!.nextBillingDate,
    };
  }

  /**
   * Save or update the user's EcoCash number.
   * If trial has already expired, immediately initiate a payment.
   */
  async saveEcocashNumber(userId: string, ecocashNumber: string): Promise<{ initiated: boolean }> {
    const normalised = this.normalisePhone(ecocashNumber);
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    await this.prisma.subscription.update({
      where: { userId },
      data: { ecocashNumber: normalised },
    });

    // If trial already expired, kick off payment now
    const now = new Date();
    const trialExpired = sub.status === SubscriptionStatus.TRIAL && sub.trialEndsAt <= now;
    const alreadyExpired = sub.status === SubscriptionStatus.EXPIRED;

    if (trialExpired || alreadyExpired) {
      await this.initiatePayment(userId, normalised);
      return { initiated: true };
    }

    return { initiated: false };
  }

  /**
   * Manually trigger a subscription payment (called from controller or cron).
   */
  async initiatePayment(userId: string, overridePhone?: string): Promise<{ reference: string; instructions: string }> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    const phone = overridePhone ?? sub.ecocashNumber;
    if (!phone) throw new BadRequestException('No EcoCash number saved. Please add your EcoCash number first.');

    const reference = `SUB-${userId.slice(0, 8)}-${Date.now()}`;
    const payment = this.paynow.createPayment(reference, this.merchantEmail);
    payment.add(`Mall263 Monthly Subscription`, SUBSCRIPTION_PRICE_USD);

    let response: any;
    try {
      response = await this.paynow.sendMobile(payment, phone, 'ecocash');
    } catch (err) {
      this.logger.error(`Paynow subscription initiation failed for user ${userId}`, err);
      throw new BadRequestException('Payment gateway unavailable. Please try again later.');
    }

    if (!response.success) {
      // Record the failed attempt
      await this.prisma.subscription.update({
        where: { userId },
        data: {
          failedAttempts: { increment: 1 },
          nextRetryAt: new Date(Date.now() + RETRY_INTERVAL_MINUTES * 60 * 1000),
        },
      });
      await this.prisma.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          amount: SUBSCRIPTION_PRICE_USD,
          paynowRef: reference,
          status: 'FAILED',
          completedAt: new Date(),
          metadata: { error: response.error },
        },
      });
      throw new BadRequestException(`Payment initiation failed: ${response.error || 'unknown error'}`);
    }

    // Record pending payment
    await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        amount: SUBSCRIPTION_PRICE_USD,
        paynowRef: reference,
        pollUrl: response.pollUrl,
        status: 'PENDING',
        metadata: { instructions: response.instructions },
      },
    });

    await this.prisma.subscription.update({
      where: { userId },
      data: { lastPaymentRef: reference },
    });

    return {
      reference,
      instructions: response.instructions || 'Check your phone for the EcoCash payment prompt and enter your PIN.',
    };
  }

  /**
   * Paynow calls this webhook when a subscription payment status changes.
   */
  async handleWebhook(body: Record<string, string>): Promise<{ ok: boolean }> {
    if (!this.paynow.verifyHash(body)) {
      this.logger.warn('Subscription webhook: invalid hash');
      return { ok: false };
    }

    const reference = body.reference;
    const status = (body.status || '').toLowerCase();
    this.logger.log(`Subscription webhook: ref=${reference} status=${status}`);

    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { paynowRef: reference } });
    if (!payment) {
      this.logger.warn(`Subscription webhook for unknown ref: ${reference}`);
      return { ok: false };
    }

    if (status === 'paid') {
      await this.onPaymentSuccess(payment.subscriptionId, reference);
    } else if (['failed', 'cancelled', 'disputed'].includes(status)) {
      await this.onPaymentFailed(payment.subscriptionId, reference, status);
    }

    return { ok: true };
  }

  /**
   * Poll a pending subscription payment by reference.
   */
  async pollPayment(reference: string): Promise<{ paid: boolean; status: string }> {
    const payment = await this.prisma.subscriptionPayment.findUnique({ where: { paynowRef: reference } });
    if (!payment) return { paid: false, status: 'NOT_FOUND' };
    if (payment.status === 'SUCCESS') return { paid: true, status: 'PAID' };

    let statusResponse: any;
    try {
      statusResponse = await this.paynow.pollTransaction(payment.pollUrl);
    } catch (err) {
      this.logger.error(`Poll failed for subscription ref ${reference}`, err);
      return { paid: false, status: 'POLL_ERROR' };
    }

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
      await this.onPaymentSuccess(payment.subscriptionId, reference);
    }

    return { paid, status: statusOut };
  }

  // ── Cron Jobs ─────────────────────────────────────────────────────────────

  /**
   * Every 30 minutes: retry pending/failed subscription payments.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async retryFailedPayments() {
    const now = new Date();

    // Find subscriptions with pending payments older than 10 mins (probably failed silently)
    const pendingOld = await this.prisma.subscriptionPayment.findMany({
      where: {
        status: 'PENDING',
        initiatedAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) },
      },
      include: { subscription: true },
      take: 50,
    });

    for (const payment of pendingOld) {
      try {
        if (!payment.pollUrl) continue;
        const res = await this.paynow.pollTransaction(payment.pollUrl);
        const st = String(res?.status ?? '').toLowerCase();
        const paid =
          res?.paid === true || (typeof res?.paid === 'function' && res.paid() === true) || st === 'paid';
        if (paid) {
          await this.onPaymentSuccess(payment.subscriptionId, payment.paynowRef!);
        }
      } catch { /* continue */ }
    }

    // Find subscriptions due for retry
    const dueRetries = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.GRACE] },
        ecocashNumber: { not: null },
        nextRetryAt: { lte: now },
      },
      take: 50,
    });

    for (const sub of dueRetries) {
      try {
        this.logger.log(`Retrying subscription payment for user ${sub.userId}`);
        await this.initiatePayment(sub.userId);
      } catch (err) {
        this.logger.error(`Retry failed for user ${sub.userId}:`, err);
      }
    }
  }

  /**
   * Daily at midnight: expire trials, initiate monthly renewals.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processDailyBilling() {
    const now = new Date();

    // 1. Expire trials that ended
    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.TRIAL,
        trialEndsAt: { lte: now },
      },
    });

    for (const sub of expiredTrials) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.EXPIRED,
          nextRetryAt: sub.ecocashNumber ? now : null,
        },
      });
      if (sub.ecocashNumber) {
        // Immediately try to charge
        try {
          await this.initiatePayment(sub.userId);
        } catch { /* will retry via cron */ }
      }
    }

    // 2. Charge ACTIVE subscriptions due today
    const dueBilling = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: { lte: now },
        ecocashNumber: { not: null },
      },
    });

    for (const sub of dueBilling) {
      try {
        this.logger.log(`Monthly renewal for user ${sub.userId}`);
        await this.initiatePayment(sub.userId);
      } catch (err) {
        this.logger.error(`Monthly renewal failed for user ${sub.userId}:`, err);
        // Move to GRACE period
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.GRACE,
            nextRetryAt: new Date(now.getTime() + RETRY_INTERVAL_MINUTES * 60 * 1000),
          },
        });
      }
    }

    // 3. Expire GRACE subscriptions older than GRACE_DAYS
    await this.prisma.subscription.updateMany({
      where: {
        status: SubscriptionStatus.GRACE,
        updatedAt: { lt: new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000) },
      },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private async onPaymentSuccess(subscriptionId: string, reference: string) {
    const now = new Date();
    const nextBilling = new Date(now);
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    await this.prisma.subscriptionPayment.updateMany({
      where: { paynowRef: reference },
      data: { status: 'SUCCESS', completedAt: now },
    });

    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: nextBilling,
        nextBillingDate: nextBilling,
        lastBilledAt: now,
        lastPaymentRef: reference,
        failedAttempts: 0,
        nextRetryAt: null,
      },
    });

    // Notify user
    await this.prisma.notification.create({
      data: {
        userId: sub.userId,
        type: NotificationType.SYSTEM,
        title: 'Subscription Active',
        body: `Your Mall263 subscription is active until ${nextBilling.toLocaleDateString()}.`,
        data: { type: 'subscription', reference },
      },
    });

    this.logger.log(`Subscription activated for user ${sub.userId} via ref ${reference}`);
  }

  private async onPaymentFailed(subscriptionId: string, reference: string, reason: string) {
    const now = new Date();
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return;

    await this.prisma.subscriptionPayment.updateMany({
      where: { paynowRef: reference },
      data: { status: 'FAILED', completedAt: now, metadata: { reason } },
    });

    const newAttempts = sub.failedAttempts + 1;
    const nextRetry = new Date(now.getTime() + RETRY_INTERVAL_MINUTES * 60 * 1000);

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        failedAttempts: newAttempts,
        nextRetryAt: nextRetry,
        status: sub.status === SubscriptionStatus.ACTIVE ? SubscriptionStatus.GRACE : sub.status,
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: sub.userId,
        type: NotificationType.SYSTEM,
        title: 'Payment Failed',
        body: 'Your subscription payment failed. We will retry automatically. Please ensure your EcoCash account has sufficient funds.',
        data: { type: 'subscription_failed', reference },
      },
    });
  }

  private normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('263')) return `+${digits}`;
    if (digits.startsWith('0')) return `+263${digits.slice(1)}`;
    return `+263${digits}`;
  }

  private maskPhone(phone: string): string {
    // Show +263 7XX XXXX 45 → +263 7** **** 45
    if (phone.length < 6) return phone;
    return phone.slice(0, 6) + '*'.repeat(phone.length - 8) + phone.slice(-2);
  }
}
