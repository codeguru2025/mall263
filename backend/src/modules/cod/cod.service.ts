import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CODRemittanceStatus, DeliveryJobStatus, Prisma } from '@prisma/client';

@Injectable()
export class CodService {
  constructor(private prisma: PrismaService) {}

  // ─── Driver confirms cash collected from buyer ────────────────────────────

  private async requireDriverForUser(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new ForbiddenException('Driver profile required');
    return driver;
  }

  async confirmCashCollected(jobId: string, userId: string) {
    const driver = await this.requireDriverForUser(userId);
    const cod = await this.prisma.cODTransaction.findUnique({
      where: { jobId },
      include: { driver: true, job: true },
    });
    if (!cod) throw new NotFoundException('COD transaction not found');
    if (cod.driverId !== driver.id) throw new ForbiddenException();
    const driverId = driver.id;
    if (cod.job.status !== DeliveryJobStatus.DELIVERED) {
      throw new BadRequestException('Delivery must be confirmed first');
    }

    // Update driver's cash held ledger
    return this.prisma.$transaction(
      async (tx) => {
        await tx.driver.update({
          where: { id: driverId },
          data: { codCashHeld: { increment: cod.cashAmount } },
        });
        return tx.cODTransaction.update({
          where: { jobId },
          data: { remittanceStatus: CODRemittanceStatus.PENDING },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Driver remits cash ───────────────────────────────────────────────────

  async remitCash(jobId: string, userId: string, remittanceRef: string) {
    const driver = await this.requireDriverForUser(userId);
    const cod = await this.prisma.cODTransaction.findUnique({
      where: { jobId },
      include: { driver: true, job: { include: { seller: true } } },
    });
    if (!cod) throw new NotFoundException('COD transaction not found');
    if (cod.driverId !== driver.id) throw new ForbiddenException();
    const driverId = driver.id;

    return this.prisma.$transaction(
      async (tx) => {
        // Re-fetch inside transaction to prevent double-remittance under concurrent requests
        const fresh = await tx.cODTransaction.findUnique({ where: { jobId } });
        if (!fresh || fresh.remittanceStatus !== CODRemittanceStatus.PENDING) {
          throw new BadRequestException('Cash is not in pending remittance state');
        }

        // Reduce driver cash held
        await tx.driver.update({
          where: { id: driverId },
          data: { codCashHeld: { decrement: cod.cashAmount } },
        });

        const updated = await tx.cODTransaction.update({
          where: { jobId },
          data: {
            remittanceStatus: CODRemittanceStatus.REMITTED,
            remittedAmount: cod.cashAmount,
            remittedAt: new Date(),
            remittanceRef,
          },
        });

        // Mark job completed
        await tx.deliveryJob.update({
          where: { id: jobId },
          data: {
            status: DeliveryJobStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        // Credit seller wallet with item amount
        const sellerWallet = await tx.wallet.findUnique({
          where: { userId: cod.job.sellerId },
        });
        if (sellerWallet) {
          const balBefore = sellerWallet.availableBalance;
          const balAfter = new Prisma.Decimal(Number(balBefore) + Number(cod.cashAmount));
          await tx.wallet.update({
            where: { userId: cod.job.sellerId },
            data: { availableBalance: balAfter },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: sellerWallet.id,
              type: 'COD_REMITTED',
              amount: cod.cashAmount,
              status: 'COMPLETED',
              balanceBefore: balBefore,
              balanceAfter: balAfter,
              description: `COD remittance for delivery job ${jobId}`,
              referenceId: jobId,
              referenceType: 'delivery_job',
            },
          });
        }

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Driver's current cash liability ─────────────────────────────────────

  async getMyLiability(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');

    const pending = await this.prisma.cODTransaction.findMany({
      where: { driverId: driver.id, remittanceStatus: CODRemittanceStatus.PENDING },
      include: { job: { select: { pickupZone: true, dropZone: true, createdAt: true } } },
    });

    const totalLiability = pending.reduce((s, t) => s + Number(t.cashAmount), 0);

    return {
      codCashHeld: driver.codCashHeld,
      maxExposure: driver.maxCodExposure,
      pendingCount: pending.length,
      totalLiability,
      transactions: pending,
    };
  }

  // ─── Admin: flag overdue COD ──────────────────────────────────────────────

  async flagOverdue(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);
    return this.prisma.cODTransaction.updateMany({
      where: {
        remittanceStatus: CODRemittanceStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      data: { remittanceStatus: CODRemittanceStatus.OVERDUE },
    });
  }
}
