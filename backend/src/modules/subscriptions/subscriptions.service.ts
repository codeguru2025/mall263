import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType, SubscriptionStatus } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paynow } = require('paynow');

const FALLBACK_PRICE_USD = 5;
const FALLBACK_TRIAL_DAYS = 7;
const GRACE_DAYS = 3;
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

  // ── Plan helpers ──────────────────────────────────────────────────────────

  /**
   * Returns the active default plan, or a safe fallback if none is configured yet.
   */
  private async getDefaultPlan() {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { isActive: true, isDefault: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plan ?? {
      priceUsd: FALLBACK_PRICE_USD,
      trialDays: FALLBACK_TRIAL_DAYS,
      name: 'Standard',
      features: [],
    };
  }

  /**
   * Public: list all active plans (for frontend subscribe modal).
   */
  async listActivePlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Promo helpers ─────────────────────────────────────────────────────────

  /**
   * Validate a promo code and return the discount to apply.
   * Returns null if code is invalid/expired/exhausted.
   */
  async validatePromoCode(code: string): Promise<{
    valid: true;
    promotionId: string;
    discountPct: number | null;
    discountAmt: number | null;
    description: string | null;
  } | { valid: false; reason: string }> {
    if (!code?.trim()) return { valid: false, reason: 'No code provided' };

    const promo = await this.prisma.promotion.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    if (!promo || !promo.isActive) return { valid: false, reason: 'Code not found or inactive' };

    const now = new Date();
    if (promo.validFrom > now) return { valid: false, reason: 'Code is not valid yet' };
    if (promo.validUntil && promo.validUntil < now) return { valid: false, reason: 'Code has expired' };
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { valid: false, reason: 'Code has reached maximum uses' };

    return {
      valid: true,
      promotionId: promo.id,
      discountPct: promo.discountPct ? Number(promo.discountPct) : null,
      discountAmt: promo.discountAmt ? Number(promo.discountAmt) : null,
      description: promo.description,
    };
  }

  private applyDiscount(basePrice: number, discountPct: number | null, discountAmt: number | null): number {
    let price = basePrice;
    if (discountPct) price = price * (1 - discountPct / 100);
    if (discountAmt) price = price - discountAmt;
    return Math.max(0.01, Math.round(price * 100) / 100); // minimum $0.01
  }

  // ── Trial ──────────────────────────────────────────────────────────────────

  /**
   * Called during user registration to start the free trial.
   * Trial length is driven by the default plan's trialDays.
   */
  async initTrial(userId: string): Promise<void> {
    const plan = await this.getDefaultPlan();
    const trialEndsAt = new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000);
    await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, status: SubscriptionStatus.TRIAL, trialEndsAt },
      update: {},
    });
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  async getStatus(userId: string) {
    let sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) {
      await this.initTrial(userId);
      sub = await this.prisma.subscription.findUnique({ where: { userId } });
    }

    const now = new Date();
    const trialActive = sub!.status === SubscriptionStatus.TRIAL && sub!.trialEndsAt > now;
    const isActive = sub!.status === SubscriptionStatus.ACTIVE;
    const isGrace = sub!.status === SubscriptionStatus.GRACE;
    const fullyAccess = trialActive || isActive || isGrace;

    const plan = await this.getDefaultPlan();

    return {
      status: sub!.status,
      trialEndsAt: sub!.trialEndsAt,
      trialActive,
      isActive,
      fullyAccess,
      hasEcocash: !!sub!.ecocashNumber,
      ecocashNumber: sub!.ecocashNumber ? this.maskPhone(sub!.ecocashNumber) : null,
      currentPeriodEnd: sub!.currentPeriodEnd,
      nextBillingDate: sub!.nextBillingDate,
      plan: {
        name: 'name' in plan ? plan.name : 'Standard',
        priceUsd: Number(plan.priceUsd),
        trialDays: plan.trialDays,
        features: plan.features as string[],
      },
    };
  }

  // ── EcoCash number ────────────────────────────────────────────────────────

  async saveEcocashNumber(userId: string, ecocashNumber: string): Promise<{ initiated: boolean }> {
    const normalised = this.normalisePhone(ecocashNumber);
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    await this.prisma.subscription.update({
      where: { userId },
      data: { ecocashNumber: normalised },
    });

    const now = new Date();
    const trialExpired = sub.status === SubscriptionStatus.TRIAL && sub.trialEndsAt <= now;
    const alreadyExpired = sub.status === SubscriptionStatus.EXPIRED;

    if (trialExpired || alreadyExpired) {
      await this.initiatePayment(userId, normalised);
      return { initiated: true };
    }

    return { initiated: false };
  }

  // ── Payment ───────────────────────────────────────────────────────────────

  async initiatePayment(
    userId: string,
    overridePhone?: string,
    promoCode?: string,
  ): Promise<{ reference: string; instructions: string; finalPrice: number; discountApplied: boolean }> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    const phone = overridePhone ?? sub.ecocashNumber;
    if (!phone) throw new BadRequestException('No EcoCash number saved. Please add your EcoCash number first.');

    const plan = await this.getDefaultPlan();
    let basePrice = Number(plan.priceUsd);
    let discountApplied = false;

    // Apply promo code if provided
    if (promoCode) {
      const validation = await this.validatePromoCode(promoCode);
      if (validation.valid) {
        basePrice = this.applyDiscount(basePrice, validation.discountPct, validation.discountAmt);
        discountApplied = true;
        // Increment used count
        await this.prisma.promotion.update({
          where: { id: validation.promotionId },
          data: { usedCount: { increment: 1 } },
        });
      }
      // If invalid, we continue without discount (don't block the payment)
    }

    const reference = `SUB-${userId.slice(0, 8)}-${Date.now()}`;
    const payment = this.paynow.createPayment(reference, this.merchantEmail);
    payment.add(`Mall263 Monthly Subscription`, basePrice);

    let response: any;
    try {
      response = await this.paynow.sendMobile(payment, phone, 'ecocash');
    } catch (err) {
      this.logger.error(`Paynow subscription initiation failed for user ${userId}`, err);
      throw new BadRequestException('Payment gateway unavailable. Please try again later.');
    }

    if (!response.success) {
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
          amount: basePrice,
          paynowRef: reference,
          status: 'FAILED',
          completedAt: new Date(),
          metadata: { error: response.error },
        },
      });
      throw new BadRequestException(`Payment initiation failed: ${response.error || 'unknown error'}`);
    }

    await this.prisma.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        amount: basePrice,
        paynowRef: reference,
        pollUrl: response.pollUrl,
        status: 'PENDING',
        metadata: { instructions: response.instructions, discountApplied, promoCode: promoCode ?? null },
      },
    });

    await this.prisma.subscription.update({
      where: { userId },
      data: { lastPaymentRef: reference, ...('id' in plan ? { planId: plan.id } : {}) },
    });

    return {
      reference,
      instructions: response.instructions || 'Check your phone for the EcoCash payment prompt and enter your PIN.',
      finalPrice: basePrice,
      discountApplied,
    };
  }

  // ── Webhook ───────────────────────────────────────────────────────────────

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

  // ── Poll ──────────────────────────────────────────────────────────────────

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

    if (terminalFail) return { paid: false, status: statusOut };
    if (paid) await this.onPaymentSuccess(payment.subscriptionId, reference);

    return { paid, status: statusOut };
  }

  // ── Cron Jobs ─────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_30_MINUTES)
  async retryFailedPayments() {
    const now = new Date();

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
        if (paid) await this.onPaymentSuccess(payment.subscriptionId, payment.paynowRef!);
      } catch { /* continue */ }
    }

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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processDailyBilling() {
    const now = new Date();

    const expiredTrials = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.TRIAL, trialEndsAt: { lte: now } },
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
        try { await this.initiatePayment(sub.userId); } catch { /* will retry via cron */ }
      }
    }

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
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: SubscriptionStatus.GRACE,
            nextRetryAt: new Date(now.getTime() + RETRY_INTERVAL_MINUTES * 60 * 1000),
          },
        });
      }
    }

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
    if (phone.length < 6) return phone;
    return phone.slice(0, 6) + '*'.repeat(phone.length - 8) + phone.slice(-2);
  }
}
