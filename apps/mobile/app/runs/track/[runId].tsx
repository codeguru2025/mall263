import {
  ActivityIndicator, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { runsApi } from '@/lib/runs-api';
import { formatMoney } from '@/lib/products';

const STATUS_COLOR: Record<string, string> = {
  OPEN: Brand.blue,
  LOCKED: Brand.primary,
  IN_PROGRESS: '#f59e0b',
  DELIVERED: Brand.green,
  COMPLETED: Brand.green,
  CANCELLED: Brand.red,
  DISPUTED: Brand.red,
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Finding a driver',
  LOCKED: 'Driver on the way to pick up',
  IN_PROGRESS: 'Items collected — in transit',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'In dispute',
};

export default function RunTrackScreen() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const q = useQuery({
    queryKey: ['run', runId],
    queryFn: () => runsApi.getById(runId!),
    enabled: !!runId,
    refetchInterval: 10_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load run.</Text>
        <Pressable style={styles.retryBtn} onPress={() => q.refetch()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const run = q.data;
  const statusColor = STATUS_COLOR[run.status] ?? Brand.muted;
  const allPicked = run.stops.every((s) => s.status === 'PICKED_UP');
  const pickedCount = run.stops.filter((s) => s.status === 'PICKED_UP').length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
    >
      {/* Status */}
      <View style={[styles.statusCard, { backgroundColor: statusColor + '14', borderColor: statusColor + '40' }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusLabel, { color: statusColor }]}>{STATUS_LABEL[run.status] ?? run.status}</Text>
          {run.driver && (
            <Text style={styles.driverLine}>
              {run.driver.user.firstName} {run.driver.user.lastName}
              {run.driver.user.phone ? ` · ${run.driver.user.phone}` : ''}
            </Text>
          )}
        </View>
        <FontAwesome name="refresh" size={14} color={statusColor} />
      </View>

      {/* Progress bar for stops */}
      {(run.status === 'LOCKED' || run.status === 'IN_PROGRESS') && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Pickup progress</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${run.stops.length > 0 ? (pickedCount / run.stops.length) * 100 : 0}%` as any }]} />
          </View>
          <Text style={styles.progressText}>
            {pickedCount} of {run.stops.length} stop(s) collected
          </Text>
          {allPicked && (
            <Text style={[styles.progressText, { color: Brand.green, fontWeight: '700' }]}>
              All items collected — driver is on the way to you!
            </Text>
          )}
        </View>
      )}

      {/* Route */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Route ({run.stops.length} stops)</Text>
        {run.stops.sort((a, b) => a.stopOrder - b.stopOrder).map((stop, i) => (
          <View key={stop.id} style={styles.stopRow}>
            <View style={[styles.stopBadge, stop.status === 'PICKED_UP' && styles.stopBadgeDone]}>
              {stop.status === 'PICKED_UP'
                ? <FontAwesome name="check" size={10} color="#fff" />
                : <Text style={styles.stopBadgeText}>{i + 1}</Text>
              }
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>{stop.stall.name}</Text>
              <Text style={styles.stopMeta}>
                {stop.items.length} item type(s) · {formatMoney(parseFloat(stop.itemAmount), 'USD')}
              </Text>
            </View>
            <Text style={[styles.stopStatus, stop.status === 'PICKED_UP' && styles.stopStatusDone]}>
              {stop.status === 'PICKED_UP' ? 'Collected' : 'Pending'}
            </Text>
          </View>
        ))}

        <View style={styles.deliveryRow}>
          <FontAwesome name="flag-checkered" size={14} color={Brand.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.deliveryZone}>{run.dropZone}</Text>
            {run.dropAddress && <Text style={styles.deliveryAddr}>{run.dropAddress}</Text>}
          </View>
          {run.status === 'DELIVERED' && (
            <FontAwesome name="check-circle" size={16} color={Brand.green} />
          )}
        </View>
      </View>

      {/* Driver card */}
      {run.driver && run.agreedFee && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Your driver</Text>
          <View style={styles.driverRow}>
            <FontAwesome name="user-circle" size={32} color={Brand.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{run.driver.user.firstName} {run.driver.user.lastName}</Text>
              <Text style={styles.driverMeta}>
                {run.driver.tier} · {run.driver.user.phone ?? ''}
              </Text>
            </View>
            <Text style={styles.agreedFee}>{formatMoney(parseFloat(run.agreedFee), 'USD')}</Text>
          </View>
        </View>
      )}

      {/* View full details button */}
      <Pressable style={styles.detailsBtn} onPress={() => router.replace({ pathname: '/runs/[runId]' as never, params: { runId: run.id } } as never)}>
        <Text style={styles.detailsBtnText}>View full run details</Text>
        <FontAwesome name="chevron-right" size={12} color={Brand.primary} />
      </Pressable>
    </ScrollView>
  );
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 14, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: Brand.red, fontWeight: '700', marginBottom: 12 },
  retryBtn: { backgroundColor: Brand.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
    borderRadius: 14, borderWidth: 1, marginBottom: 12, ...cardShadow,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 14, fontWeight: '800' },
  driverLine: { fontSize: 12, color: Brand.muted, marginTop: 2 },

  card: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 12, ...cardShadow,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  progressTrack: {
    height: 8, backgroundColor: Brand.border, borderRadius: 4, marginBottom: 8, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Brand.primary, borderRadius: 4 },
  progressText: { fontSize: 12, color: Brand.muted, fontWeight: '600' },

  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stopBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stopBadgeDone: { backgroundColor: Brand.green },
  stopBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stopInfo: { flex: 1 },
  stopName: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  stopMeta: { fontSize: 11, color: Brand.muted },
  stopStatus: { fontSize: 12, color: Brand.muted, fontWeight: '600' },
  stopStatusDone: { color: Brand.green },

  deliveryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.border,
  },
  deliveryZone: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  deliveryAddr: { fontSize: 11, color: Brand.muted, marginTop: 2 },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverName: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  driverMeta: { fontSize: 12, color: Brand.muted },
  agreedFee: { fontSize: 18, fontWeight: '900', color: Brand.primary },

  detailsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Brand.primary + '40',
    backgroundColor: Brand.primary + '08',
  },
  detailsBtnText: { fontSize: 14, fontWeight: '700', color: Brand.primary },
});
