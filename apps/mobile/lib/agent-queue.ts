/**
 * Offline task queue for field agents.
 * Tasks are persisted in AsyncStorage under QUEUE_KEY so they survive app restarts.
 * On each sync attempt, all queued tasks are sent in one batch to POST /agents/sync.
 * Successfully synced tasks are removed from the local queue.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncOfflineTasks, type AgentTaskType } from './agent-api';

const QUEUE_KEY = 'agent:offline_queue';

export type QueuedTask = {
  offlineId: string;
  type: AgentTaskType;
  data: Record<string, unknown>;
  createdAt: string;
};

export async function getQueue(): Promise<QueuedTask[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedTask[]) : [];
  } catch {
    return [];
  }
}

export async function enqueueTask(
  type: AgentTaskType,
  data: Record<string, unknown>,
): Promise<QueuedTask> {
  const task: QueuedTask = {
    offlineId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    data,
    createdAt: new Date().toISOString(),
  };
  const queue = await getQueue();
  queue.push(task);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return task;
}

async function removeFromQueue(offlineIds: string[]): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((t) => !offlineIds.includes(t.offlineId));
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

/**
 * Try to sync all queued tasks.
 * Returns { synced, failed, remaining } counts.
 * Throws if network request itself fails (caller handles retry UI).
 */
export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const result = await syncOfflineTasks(queue);
  const syncedIds = result.tasks.map((t) => t.offlineId).filter(Boolean) as string[];
  await removeFromQueue(syncedIds);

  const remaining = (await getQueue()).length;
  return { synced: result.synced, remaining };
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
