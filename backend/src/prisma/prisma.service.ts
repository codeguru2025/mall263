import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Executes an interactive transaction with automatic retry on serialization failures.
   *
   * PostgreSQL raises error code P2034 ("write conflict or deadlock") when using
   * REPEATABLE READ or SERIALIZABLE isolation and two transactions conflict.
   * The correct response is to transparently retry — the second attempt will succeed
   * because the first transaction's effects are now visible as a consistent snapshot.
   *
   * All financial transactions in this application use RepeatableRead and MUST be
   * called via this helper rather than $transaction directly.
   */
  async $retryTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      isolationLevel?: Prisma.TransactionIsolationLevel;
      maxWait?: number;
      timeout?: number;
    },
    maxRetries = 3,
  ): Promise<T> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await this.$transaction(fn, options);
      } catch (error) {
        const isSerializationError =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (isSerializationError && attempt < maxRetries) {
          attempt++;
          const backoffMs = attempt * 50; // 50ms, 100ms, 150ms
          this.logger.warn(
            `Transaction serialization failure (P2034), retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        throw error;
      }
    }
  }
}
