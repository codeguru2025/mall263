import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  fetchMyServiceRequests,
  fetchIncomingServiceRequests,
  type ServiceRequestRow,
  type ServiceRequestStatus,
} from '@/lib/services-api';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';

type Tab = 'mine' | 'incoming';

const STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  OPEN: 'Awaiting quote',
  QUOTED: 'Quote received',
  ACCEPTED: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_TINT: Record<ServiceRequestStatus, { bg: string; fg: string }> = {
  OPEN: { bg: '#fff7ed', fg: '#c2410c' },
  QUOTED: { bg: '#eff6ff', fg: '#1d4ed8' },
  ACCEPTED: { bg: '#ecfdf5', fg: '#047857' },
  COMPLETED: { bg: '#f1f5f9', fg: '#334155' },
  CANCELLED: { bg: '#fef2f2', fg: '#b91c1c' },
};

export default function MyServiceRequestsScreen() {
  const { user } = useAuth();
  const isProvider = user?.role === 'STALL_OWNER' || user?.role === 'ATTENDANT';
  const [tab, setTab] = useState<Tab>('mine');
  const [refreshing, setRefreshing] = useState(false);

  const mineQ = useQuery({
    queryKey: ['service-requests-mine'],
    queryFn: fetchMyServiceRequests,
    enabled: tab === 'mine',
  });

  const incomingQ = useQuery({
    queryKey: ['service-requests-incoming'],
    queryFn: fetchIncomingServiceRequests,
    enabled: isProvider && tab === 'incoming',
  });

  const activeQ = tab === 'mine' ? mineQ : incomingQ;
  const list = activeQ.data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await activeQ.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [activeQ]);

  return (
    <View style={styles.container}>
      {isProvider ? (
        <View style={styles.tabsRow}>
          <TabButton label="My requests" active={tab === 'mine'} onPress={() => setTab('mine')} />
          <TabButton label="Incoming" active={tab === 'incoming'} onPress={() => setTab('incoming')} />
        </View>
      ) : null}

      {activeQ.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Brand.blue} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.centered}>
          <FontAwesome name="inbox" size={28} color={Brand.muted} />
          <Text style={styles.emptyTitle}>
            {tab === 'mine' ? 'No requests yet' : 'No incoming requests yet'}
          </Text>
          <Text style={styles.emptySub}>
            {tab === 'mine'
              ? 'Browse services and request a quote to see it here.'
              : 'Requests on your services will appear here.'}
          </Text>
          {tab === 'mine' ? (
            <Pressable style={styles.browseBtn} onPress={() => router.push('/services')}>
              <Text style={styles.browseBtnText}>Browse services</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <RequestRow req={item} />}
        />
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RequestRow({ req }: { req: ServiceRequestRow }) {
  const tint = STATUS_TINT[req.status] ?? STATUS_TINT.OPEN;
  const label = STATUS_LABEL[req.status] ?? req.status;
  const created = new Date(req.createdAt);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() =>
        router.push({ pathname: '/services/requests/[requestId]', params: { requestId: req.id } })
      }
    >
      <View style={styles.iconWrap}>
        <FontAwesome name="briefcase" size={18} color={Brand.blue} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {req.listing?.title ?? 'Service'}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: tint.bg }]}>
            <Text style={[styles.statusText, { color: tint.fg }]}>{label}</Text>
          </View>
        </View>
        {req.notes ? (
          <Text style={styles.rowNotes} numberOfLines={2}>
            {req.notes}
          </Text>
        ) : null}
        <Text style={styles.rowDate}>
          {created.toLocaleDateString()} · {req.quotes?.length ?? 0} quote{(req.quotes?.length ?? 0) === 1 ? '' : 's'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  tabBtnActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  tabBtnText: { fontSize: 13, fontWeight: '800', color: Brand.navy },
  tabBtnTextActive: { color: '#fff' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  emptySub: { fontSize: 13, color: Brand.muted, textAlign: 'center' },
  browseBtn: { marginTop: 14, backgroundColor: Brand.blue, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  browseBtnText: { color: '#fff', fontWeight: '800' },

  listContent: { padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 14,
    marginBottom: 10,
  },
  rowPressed: { opacity: 0.92 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#eff6fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Brand.navy },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '800' },
  rowNotes: { fontSize: 12, color: Brand.text, lineHeight: 17 },
  rowDate: { fontSize: 11, color: Brand.muted, marginTop: 3 },
});
