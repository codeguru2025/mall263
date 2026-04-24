import { Injectable, Logger } from '@nestjs/common';
import type {
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../../redis/redis.service';

/**
 * Redis/Valkey-backed storage for @nestjs/throttler.
 *
 * Why: the built-in `ThrottlerStorageService` keeps counters in local memory,
 * which means each API instance rate-limits in isolation. Behind a load
 * balancer or with multiple App Platform instances, an attacker can burst
 * through N× the configured limit simply by fan-out.
 *
 * This implementation uses `INCR` + `PEXPIRE` to maintain a shared counter
 * per (throttlerName, tracker-key) with a separate `:blocked` sentinel for
 * the block window. If Redis is unavailable, it transparently falls back to
 * an in-process Map so the app keeps serving (degraded accuracy is better
 * than hard-failing every request).
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private warnedOnce = false;
  private readonly mem = new Map<
    string,
    { hits: number; expiresAt: number; blockExpiresAt: number }
  >();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:${throttlerName}:${key}:blocked`;

    try {
      const client = this.redis.getClient();

      const blockPttl = await client.pttl(blockKey);
      if (blockPttl && blockPttl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: Math.ceil(blockPttl / 1000),
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockPttl / 1000),
        };
      }

      const pipe = client.multi();
      pipe.incr(counterKey);
      pipe.pttl(counterKey);
      const res = await pipe.exec();
      if (!res || res.length < 2) throw new Error('empty pipeline result');

      const total = Number(res[0]?.[1] ?? 0);
      let pttl = Number(res[1]?.[1] ?? -1);
      if (pttl < 0) {
        await client.pexpire(counterKey, ttl);
        pttl = ttl;
      }

      let isBlocked = false;
      let timeToBlockExpire = 0;
      if (total > limit) {
        await client.set(blockKey, '1', 'PX', blockDuration);
        isBlocked = true;
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      }

      return {
        totalHits: total,
        timeToExpire: Math.ceil(pttl / 1000),
        isBlocked,
        timeToBlockExpire,
      };
    } catch (err) {
      if (!this.warnedOnce) {
        this.warnedOnce = true;
        this.logger.warn(
          `Redis throttler storage unavailable, falling back to in-memory counters: ${(err as Error).message}`,
        );
      }
      return this.memIncrement(counterKey, ttl, limit, blockDuration);
    }
  }

  private memIncrement(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    let rec = this.mem.get(key);
    if (!rec || rec.expiresAt <= now) {
      rec = { hits: 0, expiresAt: now + ttl, blockExpiresAt: 0 };
    }
    if (rec.blockExpiresAt > now) {
      const remaining = rec.blockExpiresAt - now;
      return {
        totalHits: limit + 1,
        timeToExpire: Math.ceil(remaining / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil(remaining / 1000),
      };
    }
    rec.hits += 1;
    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (rec.hits > limit) {
      rec.blockExpiresAt = now + blockDuration;
      isBlocked = true;
      timeToBlockExpire = Math.ceil(blockDuration / 1000);
    }
    this.mem.set(key, rec);
    return {
      totalHits: rec.hits,
      timeToExpire: Math.ceil((rec.expiresAt - now) / 1000),
      isBlocked,
      timeToBlockExpire,
    };
  }
}
