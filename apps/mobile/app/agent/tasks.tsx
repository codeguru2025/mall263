import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { fetchMyTasks, type AgentTask, type AgentTaskStatus } from '@/lib/agent-api';

const STATUS_TABS: { key: AgentTaskStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'COMPLETED', label: 'Done' },
  { key: 'FAILED', label: 'Failed' },
];

const TYPE_LABELS: Record<string, string> = {
  MERCHANT_ONBOARDING: 'Merchant Onboarding',
  PRODUCT_CAPTURE: 'Product Capture',
  QUALITY_REVIEW: 'Quality Review',
  STALL_VERIFICATION: 'Stall Verification',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: Brand.orange,
  IN_PROGRESS: Brand.blue,
  COMPLETED: Brand.green,
  FAILED: Brand.red,
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); }
  catch { return iso; }
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

export default function AgentTasksScreen() {
  const [activeTab, setActiveTab] = useState<AgentTaskStatus | 'ALL'>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const tasksQ = useQuery({
    queryKey: ['agent-tasks', activeTab],
    queryFn: () => fetchMyTasks(activeTab === 'ALL' ? undefined : activeTab),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try { await tasksQ.refetch(); }
    finally { setRefreshing(false); }
  };

  const renderTask = ({ item }: { item: AgentTask }) => (
    <View style={[styles.taskCard, cardShadow]}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskType}>{TYPE_LABELS[item.type] ?? item.type}</Text>
        <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[item.status] + '22' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.taskDate}>{fmtDate(item.createdAt)}</Text>
      {item.offlineId && (
        <Text style={styles.taskOfflineId}>offline ref: {item.offlineId.slice(-10)}</Text>
      )}
      {item.completedAt && (
        <Text style={styles.taskCompleted}>Completed {fmtDate(item.completedAt)}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.flex}>
      {/* Status filter tabs */}
      <View style={styles.tabs}>
        {STATUS_TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tasksQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.blue} /></View>
      ) : (
        <FlatList
          data={tasksQ.data ?? []}
          keyExtractor={(item: { id: string }) => item.id}
          renderItem={renderTask}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
          ListEmptyComponent={<Text style={styles.empty}>No tasks found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabs: {
    flexDirection: 'row', backgroundColor: Brand.card,
    borderBottomWidth: 1, borderBottomColor: Brand.border,
    paddingHorizontal: 12, paddingTop: 8,
  },
  tab: { paddingHorizontal: 14, paddingVertical: 10, marginRight: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Brand.blue },
  tabText: { fontSize: 13, fontWeight: '700', color: Brand.muted },
  tabTextActive: { color: Brand.blue },

  list: { padding: 16, paddingBottom: 40 },
  taskCard: {
    backgroundColor: Brand.card, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: Brand.border,
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  taskType: { fontSize: 14, fontWeight: '800', color: Brand.navy, flex: 1 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  taskDate: { fontSize: 12, color: Brand.muted },
  taskOfflineId: { fontSize: 10, color: Brand.muted, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  taskCompleted: { fontSize: 11, color: Brand.green, marginTop: 4, fontWeight: '700' },

  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },
});
