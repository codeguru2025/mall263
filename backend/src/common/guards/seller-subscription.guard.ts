import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus, UserRole } from '@prisma/client';

/** Roles permanently exempt from subscription enforcement. */
const EXEMPT_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_OPS,
  UserRole.FINANCE_ADMIN,
  UserRole.SUPPORT_ADMIN,
  UserRole.MALL_MANAGER,
]);

/**
 * Blocks seller/attendant users whose subscription trial has ended and whose
 * subscription is not ACTIVE or GRACE.
 *
 * Use this on POS, reports, and demand-bidding endpoints that require an active
 * seller subscription.
 */
@Injectable()
export class SellerSubscriptionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string; role: UserRole } | undefined;

    if (!user) return false;
    if (EXEMPT_ROLES.has(user.role)) return true;

    const sub = await this.prisma.subscription.findUnique({
      where: { userId: user.id },
      select: { status: true, trialEndsAt: true },
    });

    if (!sub) return true; // no record yet — let registration cron handle it

    const now = new Date();
    const trialActive = sub.status === SubscriptionStatus.TRIAL && sub.trialEndsAt > now;
    const paid = sub.status === SubscriptionStatus.ACTIVE || sub.status === SubscriptionStatus.GRACE;

    if (trialActive || paid) return true;

    throw new ForbiddenException(
      'Your free trial has ended. Subscribe for $5/month to access seller features (POS, reports, demand bidding).',
    );
  }
}
