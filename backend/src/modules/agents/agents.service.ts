import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MerchantsService } from '../merchants/merchants.service';
import { AgentTaskType, AgentTaskStatus } from '@prisma/client';

@Injectable()
export class AgentsService {
  constructor(
    private prisma: PrismaService,
    private merchantsService: MerchantsService,
  ) {}

  async createTask(agentId: string, data: {
    type: AgentTaskType;
    data: any;
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
        data: data.data,
        offlineId: data.offlineId,
      },
    });
  }

  async syncOfflineTasks(agentId: string, tasks: Array<{
    type: AgentTaskType;
    data: any;
    offlineId: string;
  }>) {
    const results = [];
    for (const task of tasks) {
      const result = await this.createTask(agentId, task);
      results.push(result);
    }
    return { synced: results.length, tasks: results };
  }

  async processOnboardingTask(taskId: string) {
    const task = await this.prisma.agentTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.type !== AgentTaskType.MERCHANT_ONBOARDING) {
      throw new BadRequestException('Task is not a merchant onboarding task');
    }

    const taskData = task.data as any;

    await this.prisma.agentTask.update({
      where: { id: taskId },
      data: { status: AgentTaskStatus.IN_PROGRESS },
    });

    try {
      const merchant = await this.merchantsService.onboardMerchant({
        userId: taskData.userId,
        businessName: taskData.businessName,
        businessPhone: taskData.businessPhone,
        businessEmail: taskData.businessEmail,
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
