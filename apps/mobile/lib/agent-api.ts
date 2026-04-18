import { api } from '@/lib/api';

export type AgentTaskType = 'MERCHANT_ONBOARDING' | 'PRODUCT_CAPTURE' | 'QUALITY_REVIEW' | 'STALL_VERIFICATION';
export type AgentTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type AgentTask = {
  id: string;
  type: AgentTaskType;
  status: AgentTaskStatus;
  data: Record<string, unknown>;
  offlineId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type AgentStats = {
  total: number;
  completed: number;
  pending: number;
  failed: number;
};

export type OnboardingCandidate = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
};

export async function fetchMyTasks(status?: AgentTaskStatus): Promise<AgentTask[]> {
  const { data } = await api.get<AgentTask[]>('/api/v1/agents/tasks', {
    params: status ? { status } : {},
  });
  return data;
}

export async function fetchAgentStats(): Promise<AgentStats> {
  const { data } = await api.get<AgentStats>('/api/v1/agents/stats');
  return data;
}

export async function createTask(
  type: AgentTaskType,
  taskData: Record<string, unknown>,
  offlineId: string,
): Promise<AgentTask> {
  const { data } = await api.post<AgentTask>('/api/v1/agents/tasks', {
    type,
    data: taskData,
    offlineId,
  });
  return data;
}

export async function syncOfflineTasks(
  tasks: Array<{ type: AgentTaskType; data: Record<string, unknown>; offlineId: string }>,
): Promise<{ synced: number; tasks: AgentTask[] }> {
  const { data } = await api.post('/api/v1/agents/sync', { tasks });
  return data;
}

export async function processOnboardingTask(taskId: string): Promise<unknown> {
  const { data } = await api.post(`/api/v1/agents/tasks/${taskId}/process`);
  return data;
}

export async function searchOnboardingCandidates(q: string): Promise<{ data: OnboardingCandidate[] }> {
  const { data } = await api.get<{ data: OnboardingCandidate[] }>('/api/v1/agents/onboarding-candidates', {
    params: { q },
  });
  return data;
}

export type AgentCommission = {
  id: string;
  agentId: string;
  merchantId: string;
  subscriptionId?: string | null;
  amount: string;
  currency: string;
  status: 'PENDING' | 'CREDITED' | 'REVERSED';
  paidAt?: string | null;
  createdAt: string;
  merchant: { id: string; businessName: string; status: string };
};

export type CommissionsResult = {
  data: AgentCommission[];
  totalEarned: number;
};

export async function fetchMyCommissions(): Promise<CommissionsResult> {
  const { data } = await api.get<CommissionsResult>('/api/v1/agents/commissions');
  return data;
}
