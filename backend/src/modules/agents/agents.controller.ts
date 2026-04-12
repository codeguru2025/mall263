import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, AgentTaskStatus } from '@prisma/client';

@ApiTags('Field Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.FIELD_AGENT, UserRole.SUPER_ADMIN)
@Controller('agents')
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Post('tasks')
  @ApiOperation({ summary: 'Create an agent task' })
  async createTask(@CurrentUser('id') agentId: string, @Body() data: any) {
    return this.agentsService.createTask(agentId, data);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync offline tasks (batch)' })
  async syncTasks(@CurrentUser('id') agentId: string, @Body() data: { tasks: any[] }) {
    return this.agentsService.syncOfflineTasks(agentId, data.tasks);
  }

  @Get('onboarding-candidates')
  @ApiOperation({ summary: 'Search buyers (no merchant yet) by phone digits for onboarding' })
  async onboardingCandidates(@CurrentUser('id') agentId: string, @Query('q') q: string) {
    return this.agentsService.findOnboardingCandidates(agentId, q || '');
  }

  @Post('tasks/:id/process')
  @ApiOperation({ summary: 'Process an onboarding task (creates merchant for user in task payload)' })
  async processTask(
    @Param('id') taskId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.agentsService.processOnboardingTask(taskId, userId, role);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Get my tasks' })
  async getMyTasks(@CurrentUser('id') agentId: string, @Query('status') status?: AgentTaskStatus) {
    return this.agentsService.getMyTasks(agentId, status);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get agent stats' })
  async getStats(@CurrentUser('id') agentId: string) {
    return this.agentsService.getAgentStats(agentId);
  }
}
