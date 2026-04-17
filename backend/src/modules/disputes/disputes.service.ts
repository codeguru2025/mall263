import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DisputeStatus, EscrowStatus, NotificationType, Prisma } from '@prisma/client';

@Injectable()
export class DisputesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ─── Open a dispute ───────────────────────────────────────────────────────

  async openDispute(
    jobId: string,
    userId: string,
    reason: string,
    evidence?: any,
  ) {
    const job = await this.prisma.deliveryJob.findUnique({
      where: { id: jobId },
      include: { dispute: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (![job.buyerId, job.sellerId].includes(userId)) throw new ForbiddenException();
    if (job.dispute) throw new BadRequestException('Dispute already exists for this job');
    if (!['DELIVERED', 'COMPLETED'].includes(job.status)) {
      throw new BadRequestException('Disputes can only be raised after delivery');
    }
    if (job.mode === 'DIRECT_DEAL') {
      throw new BadRequestException('Direct Deal orders have no platform escrow to dispute');
    }

    const dispute = await this.prisma.$transaction(
      async (tx) => {
        // Re-fetch escrow inside tx and confirm it is still HELD
        if (job.mode === 'SAFE_PAY') {
          const escrow = await tx.escrowAccount.findFirst({
            where: { jobId, status: EscrowStatus.HELD },
          });
          if (!escrow) {
            throw new BadRequestException('Escrow funds have already been released; dispute cannot freeze them');
          }
          await tx.escrowAccount.updateMany({
            where: { jobId, status: EscrowStatus.HELD },
            data: { status: EscrowStatus.IN_DISPUTE },
          });
        }

        return tx.dispute.create({
          data: {
            jobId,
            raisedById: userId,
            reason,
            evidence,
            status: DisputeStatus.OPEN,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Notify the other party (outside transaction — non-critical)
    const otherId = job.buyerId === userId ? job.sellerId : job.buyerId;
    await this.notifications.send(
      otherId,
      NotificationType.DISPUTE_OPENED,
      'A dispute has been raised',
      reason,
      { jobId, disputeId: dispute.id },
    );

    return dispute;
  }

  // ─── Get my disputes ──────────────────────────────────────────────────────

  async getMyDisputes(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { raisedById: userId },
          { job: { buyerId: userId } },
          { job: { sellerId: userId } },
        ],
      },
      include: {
        job: {
          select: {
            id: true,
            mode: true,
            status: true,
            itemAmount: true,
            pickupZone: true,
            dropZone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin: get all open disputes ─────────────────────────────────────────

  async getAll(status?: DisputeStatus) {
    return this.prisma.dispute.findMany({
      where: status ? { status } : undefined,
      include: {
        job: {
          include: {
            buyer: { select: { firstName: true, lastName: true, phone: true } },
            seller: { select: { firstName: true, lastName: true, phone: true } },
            driver: { include: { user: { select: { firstName: true, lastName: true } } } },
            escrow: true,
          },
        },
        raisedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin: resolve dispute ───────────────────────────────────────────────

  async resolveDispute(
    disputeId: string,
    adminId: string,
    outcome: DisputeStatus,
    resolution: string,
  ) {
    if (outcome === DisputeStatus.OPEN || outcome === DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException('outcome must be a resolved status');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const dispute = await tx.dispute.findUnique({
          where: { id: disputeId },
          include: { job: { include: { escrow: true } } },
        });
        if (!dispute) throw new NotFoundException('Dispute not found');
        if (dispute.status === DisputeStatus.OPEN || dispute.status === DisputeStatus.UNDER_REVIEW) {
          // proceed
        } else {
          throw new BadRequestException('Dispute already resolved');
        }

        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: outcome,
            resolution,
            resolvedById: adminId,
            resolvedAt: new Date(),
          },
        });

        const job = dispute.job;
        const escrow = job.escrow;

        if (escrow && escrow.status === EscrowStatus.IN_DISPUTE) {
          if (outcome === DisputeStatus.RESOLVED_BUYER) {
            // Refund buyer
            await tx.escrowAccount.update({
              where: { id: escrow.id },
              data: { status: EscrowStatus.REFUNDED_TO_BUYER, releasedAt: new Date() },
            });
            await this.creditWallet(tx, job.buyerId, Number(escrow.totalHeld), disputeId, 'ESCROW_REFUND');
          } else if (outcome === DisputeStatus.RESOLVED_SELLER) {
            // Pay seller
            await tx.escrowAccount.update({
              where: { id: escrow.id },
              data: { status: EscrowStatus.RELEASED_TO_SELLER, releasedAt: new Date() },
            });
            const sellerAmt = Number(escrow.itemAmount) - Number(escrow.platformFee);
            await this.creditWallet(tx, job.sellerId, sellerAmt, disputeId, 'ESCROW_RELEASE');
          } else {
            // Reserve absorbs; refund buyer
            await tx.escrowAccount.update({
              where: { id: escrow.id },
              data: { status: EscrowStatus.REFUNDED_TO_BUYER, releasedAt: new Date() },
            });
            await this.creditWallet(tx, job.buyerId, Number(escrow.totalHeld), disputeId, 'ESCROW_REFUND');
          }
        }

        // Notify both parties
        await Promise.all([
          this.notifications.send(
            job.buyerId,
            NotificationType.DISPUTE_RESOLVED,
            'Dispute resolved',
            resolution,
            { disputeId, outcome },
          ),
          this.notifications.send(
            job.sellerId,
            NotificationType.DISPUTE_RESOLVED,
            'Dispute resolved',
            resolution,
            { disputeId, outcome },
          ),
        ]);

        return { success: true, outcome };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ─── Admin: update dispute status ─────────────────────────────────────────

  async updateStatus(disputeId: string, status: DisputeStatus) {
    return this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status },
    });
  }

  // ─── Internal: credit wallet ──────────────────────────────────────────────

  private async creditWallet(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    reference: string,
    type: string,
  ) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) return;
    const balBefore = wallet.availableBalance;
    const balAfter = new Prisma.Decimal(Number(balBefore) + amount);
    await tx.wallet.update({
      where: { userId },
      data: { availableBalance: balAfter },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: type as any,
        amount: new Prisma.Decimal(amount),
        status: 'COMPLETED',
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: `Dispute resolution: ${reference}`,
        referenceId: reference,
        referenceType: 'dispute',
      },
    });
  }
}
