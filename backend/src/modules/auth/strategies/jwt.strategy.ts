import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { CacheKeys, CacheTTL } from '../../../common/cache-keys';
import { UserRole, UserStatus } from '@prisma/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; role: string }) {
    // Reject tokens whose `sub` isn't a valid UUID before Prisma ever sees it.
    if (!payload?.sub || !UUID_RE.test(payload.sub)) {
      throw new UnauthorizedException('Invalid token');
    }

    const cacheKey = CacheKeys.jwtUser(payload.sub);

    // Cache hit — skip DB entirely for the common case
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      // Redis unavailable — fall through to DB (graceful degradation)
    }

    // Cache miss — hit the DB
    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          status: true,
        },
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // For DRIVER users, attach the driver-table PK so controllers can pass
    // the correct FK to service methods (driver.id ≠ user.id).
    let result: typeof user & { driverId?: string | null } = user;
    if (user.role === UserRole.DRIVER) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      result = { ...user, driverId: driver?.id ?? null };
    }

    // Populate cache — Redis failures must not break authentication
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), CacheTTL.JWT_USER);
    } catch {
      // continue without caching
    }

    return result;
  }
}
