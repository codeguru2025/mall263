import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Owner or active attendant may manage stall data (inventory, expenses, reports). */
export async function assertUserCanAccessStall(
  prisma: PrismaService,
  userId: string,
  userRole: UserRole,
  stallId: string,
): Promise<void> {
  const stall = await prisma.stall.findUnique({
    where: { id: stallId },
    include: { merchant: { select: { userId: true } } },
  });
  if (!stall) throw new NotFoundException('Stall not found');
  if (stall.merchant.userId === userId) return;
  if (userRole === UserRole.ATTENDANT) {
    const att = await prisma.stallAttendant.findFirst({
      where: { stallId, userId, isActive: true },
    });
    if (att) return;
  }
  throw new ForbiddenException('No access to this stall');
}
