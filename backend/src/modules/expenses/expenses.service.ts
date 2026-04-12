import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, UserRole } from '@prisma/client';
import { assertUserCanAccessStall } from '../../common/utils/stall-access';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async list(
    stallId: string,
    userId: string,
    userRole: UserRole,
    params: { startDate?: Date; endDate?: Date; category?: ExpenseCategory; limit?: number },
  ) {
    await assertUserCanAccessStall(this.prisma, userId, userRole, stallId);
    const limit = Number.isFinite(params.limit) ? Math.min(200, Math.max(1, params.limit!)) : 100;
    const where: any = { stallId };
    if (params.startDate || params.endDate) {
      where.occurredAt = {};
      if (params.startDate) where.occurredAt.gte = params.startDate;
      if (params.endDate) where.occurredAt.lte = params.endDate;
    }
    if (params.category) where.category = params.category;

    return this.prisma.stallExpense.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
      include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async create(
    stallId: string,
    userId: string,
    userRole: UserRole,
    data: {
      category: ExpenseCategory;
      amount: number;
      currency?: string;
      description?: string;
      occurredAt: string | Date;
    },
  ) {
    await assertUserCanAccessStall(this.prisma, userId, userRole, stallId);
    const occurredAt = typeof data.occurredAt === 'string' ? new Date(data.occurredAt) : data.occurredAt;
    if (isNaN(occurredAt.getTime())) throw new BadRequestException('Invalid occurredAt date');

    return this.prisma.stallExpense.create({
      data: {
        stallId,
        category: data.category,
        amount: data.amount,
        currency: data.currency || 'USD',
        description: data.description,
        occurredAt,
        recordedById: userId,
      },
      include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async update(
    expenseId: string,
    userId: string,
    userRole: UserRole,
    data: Partial<{
      category: ExpenseCategory;
      amount: number;
      currency: string;
      description: string | null;
      occurredAt: string | Date;
    }>,
  ) {
    const exp = await this.prisma.stallExpense.findUnique({ where: { id: expenseId } });
    if (!exp) throw new NotFoundException('Expense not found');
    await assertUserCanAccessStall(this.prisma, userId, userRole, exp.stallId);

    const update: any = {};
    if (data.category !== undefined) update.category = data.category;
    if (data.amount !== undefined) update.amount = data.amount;
    if (data.currency !== undefined) update.currency = data.currency;
    if (data.description !== undefined) update.description = data.description;
    if (data.occurredAt !== undefined) {
      const d = typeof data.occurredAt === 'string' ? new Date(data.occurredAt) : data.occurredAt;
      if (isNaN(d.getTime())) throw new BadRequestException('Invalid occurredAt date');
      update.occurredAt = d;
    }

    return this.prisma.stallExpense.update({
      where: { id: expenseId },
      data: update,
      include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async remove(expenseId: string, userId: string, userRole: UserRole) {
    const exp = await this.prisma.stallExpense.findUnique({ where: { id: expenseId } });
    if (!exp) throw new NotFoundException('Expense not found');
    await assertUserCanAccessStall(this.prisma, userId, userRole, exp.stallId);
    await this.prisma.stallExpense.delete({ where: { id: expenseId } });
    return { ok: true as const };
  }
}
