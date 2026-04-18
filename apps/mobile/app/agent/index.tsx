import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { fetchAgentStats } from '@/lib/agent-api';
import { getQueue, flushQueue, type QueuedTask } from '@/lib/agent-queue';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

const TASK_TYPE_LABELS: Record<string, string> = {
  MERCHANT_ONBOARDING: 'Merchant onboarding',
  PRODUCT_CAPTURE: 'Product capture',
  QUALITY_REVIEW: 'Quality review',
  STALL_VERIFICATION: 'Stall verification',
};

export default function AgentHomeScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [queue, setQueue] = useState<QueuedTask[]>([]);
  const [syncing, setSyncing] = useState(false);

  const statsQ = useQuery({ queryKey: ['agent-stats'], queryFn: fetchAgentStats });

  const loadQueue = useCallback(async () => {
    setQueue(await getQueue());
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([statsQ.refetch(), loadQueue()]);
    } finally {
      setRefreshing(false);
    }
  }, [statsQ, loadQueue]);

  const handleSync = async () => {
    if (queue.length === 0) { Alert.alert('Nothing to sync', 'Offline queue is empty.'); return; }
    setSyncing(true);
    try {
      const result = await flushQueue();
      await Promise.all([statsQ.refetch(), loadQueue()]);
      await qc.invalidateQueries({ queryKey: ['agent-tasks'] });
      Alert.alert('Synced', `${result.synced} task${result.synced !== 1 ? 's' : ''} uploaded.${result.remaining > 0 ? ` ${result.remaining} remaining in queue.` : ''}`);
    } catch {
      Alert.alert('Sync failed', 'Check your connection and try again. Tasks remain saved locally.');
    } finally {
      setSyncing(false);
    }
  };

  const stats = statsQ.data;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
    >
      {/* Stats cards */}
      <View style={styles.statsGrid}>
        {[
          { label: 'Total tasks', value: stats?.total ?? '—', color: Brand.navy },
          { label: 'Completed', value: stats?.completed ?? '—', color: Brand.green },
          { label: 'Pending', value: stats?.pending ?? '—', color: Brand.orange },
          { label: 'Failed', value: stats?.failed ?? '—', color: Brand.red },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, cardShadow]}>
            <Text style={[styles.statValue, { color: s.color }]}>{statsQ.isPending ? '…' : s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Offline queue */}
      <View style={[styles.queueCard, cardShadow]}>
        <View style={styles.queueHeader}>
          <View>
            <Text style={styles.queueTitle}>Offline queue</Text>
            <Text style={styles.queueSub}>{queue.length} task{queue.length !== 1 ? 's' : ''} waiting to sync</Text>
          </View>
          <Pressable
            style={[styles.syncBtn, (syncing || queue.length === 0) && styles.btnDisabled]}
            onPress={handleSync}
            disabled={syncing || queue.length === 0}
          >
            {syncing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.syncBtnText}>Sync now</Text>
            }
          </Pressable>
        </View>
        {queue.length > 0 && (
          <View style={styles.queueList}>
            {queue.map((t) => (
              <View key={t.offlineId} style={styles.queueItem}>
                <Text style={styles.queueItemType}>{TASK_TYPE_LABELS[t.type] ?? t.type}</Text>
                <Text style={styles.queueItemId}>offline · {t.offlineId.slice(-6)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Actions</Text>
      <Pressable style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]} onPress={() => router.push('/agent/recruit' as any)}>
        <Text style={styles.actionBtnText}>Recruit new contact</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, { backgroundColor: Brand.blue }]} onPress={() => router.push('/agent/onboard')}>
        <Text style={styles.actionBtnText}>Onboard existing buyer</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, { backgroundColor: Brand.orange }]} onPress={() => router.push('/agent/capture')}>
        <Text style={styles.actionBtnText}>Capture product</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, { backgroundColor: '#0f766e' }]} onPress={() => router.push('/agent/stall-verify' as any)}>
        <Text style={styles.actionBtnText}>Verify stall</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, { backgroundColor: Brand.green }]} onPress={() => router.push('/agent/commissions' as any)}>
        <Text style={styles.actionBtnText}>My commissions & pipeline</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border }]} onPress={() => router.push('/agent/tasks')}>
        <Text style={[styles.actionBtnText, { color: Brand.navy }]}>View all tasks</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 40 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, minWidth: '44%', backgroundColor: Brand.card,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border,
  },
  statValue: { fontSize: 26, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 2 },

  queueCard: {
    backgroundColor: Brand.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 20,
  },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  queueTitle: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  queueSub: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  syncBtn: { backgroundColor: Brand.blue, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  syncBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
  queueList: { marginTop: 12, gap: 6 },
  queueItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Brand.border,
  },
  queueItemType: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  queueItemId: { fontSize: 11, color: Brand.muted },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  actionBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10,
  },
  actionBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
