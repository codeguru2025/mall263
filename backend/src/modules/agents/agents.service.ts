import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantsService } from '../merchants/merchants.service';
import { AgentTaskType, AgentTaskStatus, Prisma, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AgentsService {
  constructor(
    private prisma: PrismaService,
    private merchantsService: MerchantsService,
  ) {}

  async createTask(agentId: string, data: {
    type: AgentTaskType;
    data: Record<string, unknown>;
    offlineId?: string;
  }) {
    if (data.offlineId) {
      const existing = await this.prisma.agentTask.findUnique({ where: { offlineId: data.offlineId } });
      if (existing) return existing; // Idempotent for offline sync
    }

    return this.prisma.agentTask.create({
      data: {
        agentId,
        type: data.type,
        status: AgentTaskStatus.PENDING,
        data: data.data as Prisma.InputJsonValue,
        offlineId: data.offlineId,
      },
    });
  }

  async syncOfflineTasks(agentId: string, tasks: Array<{
    type: AgentTaskType;
    data: Record<string, unknown>;
    offlineId: string;
  }>) {
    const results = [];
    for (const task of tasks) {
      const result = await this.createTask(agentId, task);
      results.push(result);
    }
    return { synced: results.length, tasks: results };
  }

  /**
   * Buyers without a merchant profile — for field agents to find who they can onboard.
   */
  async findOnboardingCandidates(_agentId: string, query: string) {
    const digits = query.replace(/\D/g, '');
    if (digits.length < 5) {
      throw new BadRequestException('Enter at least 5 digits of the seller phone number');
    }
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.BUYER,
        phone: { contains: digits },
        merchant: { is: null },
        status: { not: UserStatus.SUSPENDED },
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return { data: users };
  }

  async processOnboardingTask(taskId: string, requesterId: string, requesterRole: UserRole) {
    const task = await this.prisma.agentTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.agentId !== requesterId && requesterRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You can only process your own tasks');
    }
    if (task.type !== AgentTaskType.MERCHANT_ONBOARDING) {
      throw new BadRequestException('Task is not a merchant onboarding task');
    }

    const taskData = task.data as {
      userId?: string;
      businessName?: string;
      businessPhone?: string;
    };

    if (!taskData.userId || typeof taskData.userId !== 'string' || !taskData.businessName?.trim()) {
      throw new BadRequestException('Task payload must include userId and businessName');
    }

    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: { status: AgentTaskStatus.IN_PROGRESS },
    });

    try {
      const merchant = await this.merchantsService.onboardMerchant({
        userId: taskData.userId,
        businessName: taskData.businessName,
        businessPhone: taskData.businessPhone,
        agentId: task.agentId,
      });

      await this.prisma.agentTask.update({
        where: { id: taskId },
        data: { status: AgentTaskStatus.COMPLETED, completedAt: new Date(), syncedAt: new Date() },
      });

      return merchant;
    } catch (error) {
      await this.prisma.agentTask.update({
        where: { id: taskId },
        data: { status: AgentTaskStatus.FAILED },
      });
      throw error;
    }
  }

  async getMyTasks(agentId: string, status?: AgentTaskStatus) {
    const where: any = { agentId };
    if (status) where.status = status;
    return this.prisma.agentTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAgentStats(agentId: string) {
    const [total, completed, pending, failed] = await Promise.all([
      this.prisma.agentTask.count({ where: { agentId } }),
      this.prisma.agentTask.count({ where: { agentId, status: AgentTaskStatus.COMPLETED } }),
      this.prisma.agentTask.count({ where: { agentId, status: AgentTaskStatus.PENDING } }),
      this.prisma.agentTask.count({ where: { agentId, status: AgentTaskStatus.FAILED } }),
    ]);
    return { total, completed, pending, failed };
  }
}
