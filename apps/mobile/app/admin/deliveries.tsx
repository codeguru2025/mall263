import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'];

const STATUS_COLOR: Record<string, string> = {
  BROADCAST: Brand.muted,
  ACCEPTED: Brand.primary,
  PICKUP_CONFIRMED: Brand.primary,
  IN_TRANSIT: Brand.orange,
  DELIVERED: Brand.green,
  COMPLETED: Brand.green,
  CANCELLED: Brand.red,
  RETURNED: Brand.red,
};

const MODE_ICON: Record<string, string> = {
  SAFE_PAY: '🔒',
  CASH_ON_DELIVERY: '💵',
  DIRECT_DEAL: '🤝',
};

const STATUSES = ['', 'BROADCAST', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

type Job = {
  id: string;
  status: string;
  mode: string;
  itemAmount: unknown;
  deliveryFee: unknown;
  platformFee: unknown;
  createdAt: string;
  pickupAddress?: string | null;
  dropAddress?: string | null;
  driver?: { user?: { firstName: string; lastName: string } | null } | null;
};

function fmt(v: unknown) {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}

export default function AdminDeliveriesScreen() {
  const { isAuthenticated, user } = useAuth();
  const [filter, setFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.replace('/admin');
  }, [isAuthenticated, user]);

  const jobsQ = useQuery({
    queryKey: ['admin-deliveries', filter],
    queryFn: () =>
      api.get<Job[]>('/api/v1/delivery/jobs', { params: { status: filter || undefined, limit: 100 } }).then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await jobsQ.refetch(); } finally { setRefreshing(false); }
  }, [jobsQ]);

  const renderJob = ({ item }: { item: Job }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.meta}>{fmtDate(item.createdAt)}</Text>
          <Text style={styles.name} numberOfLines={1}>{item.pickupAddress ?? '—'} → {item.dropAddress ?? '—'}</Text>
          {item.driver?.user && (
            <Text style={styles.meta}>Driver: {item.driver.user.firstName} {item.driver.user.lastName}</Text>
          )}
        </View>
        <View style={styles.badgeCol}>
          <View style={[styles.pill, { backgroundColor: (STATUS_COLOR[item.status] ?? Brand.muted) + '22' }]}>
            <Text style={[styles.pillText, { color: STATUS_COLOR[item.status] ?? Brand.muted }]}>{item.status}</Text>
          </View>
          <Text style={styles.modeChip}>{MODE_ICON[item.mode] ?? '📦'} {item.mode.replace('_', ' ')}</Text>
        </View>
      </View>
      <View style={styles.amounts}>
        <Text style={styles.amtLabel}>Item</Text>
        <Text style={styles.amtVal}>{fmt(item.itemAmount)}</Text>
        <Text style={styles.amtLabel}>Fee</Text>
        <Text style={styles.amtVal}>{fmt(item.deliveryFee)}</Text>
        <Text style={styles.amtLabel}>Platform</Text>
        <Text style={styles.amtVal}>{fmt(item.platformFee)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.flex}>
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {STATUSES.map((s) => (
          <Pressable
            key={s || 'ALL'}
            style={[styles.chip, filter === s && styles.chipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
              {s || 'All'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {jobsQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
      ) : (
        <FlatList
          data={jobsQ.data ?? []}
          keyExtractor={(item: Job) => item.id}
          renderItem={renderJob}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
          ListHeaderComponent={<Text style={styles.count}>{jobsQ.data?.length ?? 0} job{jobsQ.data?.length !== 1 ? 's' : ''}</Text>}
          ListEmptyComponent={<Text style={styles.empty}>No delivery jobs found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  filterScroll: { maxHeight: 52, backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border },
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Brand.pageBg, borderWidth: 1, borderColor: Brand.border },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
  chipTextActive: { color: '#fff' },

  list: { padding: 12, paddingBottom: 40 },
  count: { fontSize: 12, color: Brand.muted, marginBottom: 8 },

  card: { backgroundColor: Brand.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Brand.border },
  cardTop: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  name: { fontSize: 13, fontWeight: '700', color: Brand.navy, marginTop: 2 },
  meta: { fontSize: 11, color: Brand.muted },
  badgeCol: { alignItems: 'flex-end', gap: 4 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 10, fontWeight: '800' },
  modeChip: { fontSize: 10, color: Brand.muted, fontWeight: '700' },

  amounts: { flexDirection: 'row', gap: 12 },
  amtLabel: { fontSize: 10, color: Brand.muted, fontWeight: '700', textTransform: 'uppercase' },
  amtVal: { fontSize: 13, fontWeight: '800', color: Brand.navy },

  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },
});
