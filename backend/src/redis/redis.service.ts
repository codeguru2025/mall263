import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Mall263 uses Redis / DigitalOcean Valkey only for **ephemeral payment session state**,
 * not as a system of record for money or inventory.
 *
 * - **Payments (Paynow):** keys `paynow:pending:{reference}` hold { userId, amount, pollUrl, method, credited? }
 *   with TTL so the app can poll Paynow and correlate webhooks. Wallet balances stay **ACID in PostgreSQL**
 *   (`WalletService.deposit` uses RepeatableRead + idempotent `externalRef`).
 * - **Health:** `PING` for readiness / degraded reporting (`/health`).
 *
 * If Valkey is unavailable, deposits cannot be *initiated* (no pending metadata); already-recorded wallet
 * rows remain correct. A paid webhook arriving after the pending key TTL expires cannot auto-credit —
 * operations should reconcile via Paynow dashboard + `wallet_transactions.external_ref`.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private config: ConfigService) {
    const tlsEnabled = this.config.get('REDIS_TLS', 'false') === 'true';
    this.client = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: parseInt(this.config.get('REDIS_PORT', '6379'), 10),
      password: this.config.get('REDIS_PASSWORD', '') || undefined,
      maxRetriesPerRequest: 3,
      connectTimeout: 10_000,
      // Fail fast when disconnected instead of buffering commands indefinitely (API latency / overload)
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      tls: tlsEnabled
        ? { rejectUnauthorized: this.config.get('REDIS_TLS_REJECT_UNAUTHORIZED', 'true') !== 'false' }
        : undefined,
    });

    this.client.on('error', (err: Error) => {
      this.logger.warn(`Redis/Valkey client error: ${err.message}`);
    });
    this.client.on('connect', () => {
      this.logger.debug(`Redis/Valkey socket ready (${this.config.get('REDIS_HOST')}:${this.config.get('REDIS_PORT', '6379')})`);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
