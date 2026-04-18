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
import { getMyDisputes } from '@/lib/delivery-api';
import { Brand } from '@/constants/brand';

function statusColor(status: string) {
  const s = status?.toUpperCase?.() ?? '';
  if (s === 'RESOLVED' || s === 'CLOSED') return { bg: '#ecfdf5', fg: '#16a34a' };
  if (s === 'REJECTED') return { bg: '#fef2f2', fg: '#b91c1c' };
  if (s === 'IN_REVIEW' || s === 'UNDER_REVIEW') return { bg: '#eff6fc', fg: Brand.blue };
  return { bg: '#fff7ed', fg: '#ea580c' };
}

function formatMoney(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 'USD 0.00';
  return `USD ${n.toFixed(2)}`;
}

export default function MyDisputesScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const q = useQuery({
    queryKey: ['my-disputes'],
    queryFn: getMyDisputes,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [q]);

  return (
    <View style={styles.container}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(d: { id: string }) => d.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }: { item: { id: string; jobId: string; reason: string; status: string; resolution?: string; createdAt: string; job?: { pickupZone: string; dropZone: string; itemAmount: number | string } } }) => {
          const c = statusColor(item.status);
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/delivery/track/[jobId]', params: { jobId: item.jobId } })
              }
            >
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.statusText, { color: c.fg }]}>
                    {(item.status ?? 'PENDING').replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.reason} numberOfLines={2}>
                {item.reason}
              </Text>
              <View style={styles.meta}>
                <FontAwesome name="truck" size={11} color={Brand.muted} />
                <Text style={styles.metaText}>
                  {item.job?.pickupZone ?? 'Pickup'} → {item.job?.dropZone ?? 'Drop'}
                </Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{formatMoney(item.job?.itemAmount)}</Text>
              </View>
              {item.resolution ? (
                <View style={styles.resolution}>
                  <FontAwesome name="gavel" size={11} color={Brand.blue} />
                  <Text style={styles.resolutionText} numberOfLines={3}>
                    {item.resolution}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator color={Brand.blue} style={{ marginTop: 24 }} />
          ) : (
            <View style={styles.emptyBox}>
              <FontAwesome name="handshake-o" size={32} color={Brand.muted} />
              <Text style={styles.emptyTitle}>No disputes</Text>
              <Text style={styles.emptySub}>
                You haven&apos;t opened any disputes yet. If there&apos;s a problem with a delivery,
                open one from the tracking screen.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  listContent: { padding: 14, paddingBottom: 40 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  date: { fontSize: 11, color: Brand.muted },
  reason: { fontSize: 14, color: Brand.text, fontWeight: '600', marginBottom: 8, lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: Brand.muted },
  metaDot: { fontSize: 12, color: Brand.muted, marginHorizontal: 2 },

  resolution: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    backgroundColor: '#eff6fc',
    borderRadius: 10,
  },
  resolutionText: { fontSize: 12, color: Brand.navy, lineHeight: 17, flex: 1 },

  emptyBox: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 14,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    marginTop: 20,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  emptySub: { fontSize: 12, color: Brand.muted, textAlign: 'center', lineHeight: 17 },
});
