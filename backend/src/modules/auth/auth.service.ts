import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CacheKeys } from '../../common/cache-keys';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto/auth.dto';
import { UserRole, UserStatus } from '@prisma/client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private subscriptions: SubscriptionsService,
    private audit: AuditService,
    private redis: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Hash password outside the transaction (CPU-bound, no DB concern)
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const role = dto.role || UserRole.BUYER;

    const user = await this.prisma.$transaction(async (tx) => {
      // Uniqueness checks INSIDE the transaction to prevent TOCTOU race
      const existing = await tx.user.findUnique({ where: { phone: dto.phone } });
      if (existing) throw new ConflictException('Phone number already registered');

      const newUser = await tx.user.create({
        data: {
          phone: dto.phone,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatarUrl: dto.avatarUrl,
          role,
          status: UserStatus.ACTIVE,
        },
      });

      // Create wallet for every user
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          availableBalance: 0,
          lockedBalance: 0,
          currency: 'USD',
        },
      });

      // Create trust score
      await tx.trustScore.create({
        data: {
          userId: newUser.id,
          overallScore: 50,
          fundingScore: 50,
          completionScore: 50,
          cancellationScore: 50,
          responseScore: 50,
          accuracyScore: 50,
        },
      });

      return newUser;
    });

    // Start 7-day free trial for new users (fire-and-forget, don't block registration)
    this.subscriptions.initTrial(user.id).catch(() => {});
    this.audit.log({ userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id, newValue: { role } }).catch(() => {});

    const tokens = await this.generateTokens(user.id, user.role);
    const subscription = await this.subscriptions.getStatus(user.id).catch(() => null);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl ?? undefined,
        status: user.status,
        role: user.role,
        subscription,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended. Contact support.');
    }
    if (user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException('Account deactivated.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.audit.log({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id }).catch(() => {});

    const tokens = await this.generateTokens(user.id, user.role);
    const subscription = await this.subscriptions.getStatus(user.id).catch(() => null);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl ?? undefined,
        status: user.status,
        role: user.role,
        subscription,
      },
    };
  }

  /**
   * Rotate a refresh token.
   *
   * Security model — "rotation family with reuse detection":
   * - Every token issued within a single login → refresh chain shares a `familyId`.
   * - On rotation, the old token is marked revoked AND `replacedById` is set to
   *   the new token. The new token is the head of the family.
   * - If the caller presents an **already-revoked** token, that means the token
   *   was stolen and used AFTER a legitimate rotation — we revoke the ENTIRE
   *   family (forcing re-login) and emit an audit event.
   * - Concurrent rotations with the same token are resolved by using the
   *   revokedAt=null filter inside `updateMany` so only ONE call can win.
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.refreshToken.findUnique({ where: { token: refreshToken } });
      if (!stored) throw new UnauthorizedException('Invalid refresh token');

      // Expired — never rotate, just reject
      if (stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      // REUSE DETECTED: this token was already rotated. Revoke the entire family
      // and force re-login. This is the classic stolen-refresh-token defence.
      if (stored.revokedAt) {
        await tx.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'FAMILY_COMPROMISED' },
        });
        this.audit
          .log({
            userId: stored.userId,
            action: 'REFRESH_TOKEN_REUSE_DETECTED',
            entity: 'RefreshToken',
            entityId: stored.id,
            newValue: { familyId: stored.familyId },
          })
          .catch(() => {});
        throw new UnauthorizedException('Refresh token reuse detected — session revoked');
      }

      // Race-safe revoke: only if still non-revoked. Concurrent refreshes with the
      // same token will race — exactly one succeeds with count=1.
      const revoke = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'ROTATED' },
      });
      if (revoke.count !== 1) {
        // Another request just rotated this token; treat as reuse.
        throw new UnauthorizedException('Refresh token already rotated');
      }

      const user = await tx.user.findUnique({ where: { id: stored.userId } });
      if (!user) throw new UnauthorizedException('User not found');
      if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
        throw new UnauthorizedException('Account is not active');
      }

      // Issue new token in the SAME family and link old→new
      const next = await this.issueRefreshToken(tx, user.id, stored.familyId);
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { replacedById: next.id },
      });

      const accessToken = this.jwt.sign({ sub: user.id, role: user.role });
      return { accessToken, refreshToken: next.token };
    });
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });
    try { await this.redis.del(CacheKeys.jwtUser(userId)); } catch {}
    this.audit.log({ userId, action: 'LOGOUT', entity: 'User', entityId: userId }).catch(() => {});
  }

  private async generateTokens(userId: string, role: UserRole) {
    const accessToken = this.jwt.sign({ sub: userId, role });
    const issued = await this.issueRefreshToken(this.prisma, userId);
    return { accessToken, refreshToken: issued.token };
  }

  /**
   * Persist a fresh refresh token row. `familyId` is reused on rotation and
   * generated fresh at login/registration.
   */
  private async issueRefreshToken(
    db: { refreshToken: { create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; token: string; familyId: string }> } },
    userId: string,
    familyId?: string,
  ) {
    const token = uuid();
    const refreshExpDays = parseInt(this.config.get('JWT_REFRESH_EXPIRATION', '7'), 10);
    return db.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + refreshExpDays * 24 * 60 * 60 * 1000),
        ...(familyId ? { familyId } : {}),
      },
    }) as Promise<{ id: string; token: string; familyId: string }>;
  }
}
