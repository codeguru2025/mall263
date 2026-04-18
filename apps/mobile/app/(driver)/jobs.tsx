import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { acceptJob, getBroadcastJobs, type DeliveryJob } from '@/lib/delivery-api';

const MODE_BADGE: Record<string, { label: string; color: string }> = {
  SAFE_PAY: { label: 'SafePay', color: Brand.blue },
  CASH_ON_DELIVERY: { label: 'COD', color: Brand.green },
  DIRECT_DEAL: { label: 'Direct', color: Brand.muted },
};

export default function DriverJobsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery<DeliveryJob[]>({
    queryKey: ['broadcast-jobs'],
    queryFn: getBroadcastJobs,
    refetchInterval: 20_000,
  });

  const acceptMutation = useMutation({
    mutationFn: (jobId: string) => acceptJob(jobId),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['broadcast-jobs'] });
      router.push({ pathname: '/delivery/track/[jobId]', params: { jobId: job.id } });
    },
    onError: (err: unknown) =>
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not accept job'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: DeliveryJob }) => {
      const badge = MODE_BADGE[item.mode] ?? { label: item.mode, color: Brand.muted };
      return (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={[styles.badge, { backgroundColor: badge.color }]}>
              <Text style={styles.badgeText}>{badge.label}</Text>
            </View>
            <Text style={styles.earning}>${Number(item.driverEarning).toFixed(2)}</Text>
          </View>
          <Text style={styles.zones}>
            {item.pickupZone} → {item.dropZone}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.fee}>
              Item: ${Number(item.itemAmount).toFixed(2)}
            </Text>
            {(item as any).distFromDriverKm != null && (
              <View style={styles.distBadge}>
                <Text style={styles.distText}>📍 {(item as any).distFromDriverKm} km away</Text>
              </View>
            )}
            <View style={styles.radiusBadge}>
              <Text style={styles.radiusText}>⬤ {(item as any).radiusKm ?? 10} km zone</Text>
            </View>
          </View>
          <Pressable
            style={[styles.acceptBtn, acceptMutation.isPending && styles.disabled]}
            onPress={() =>
              Alert.alert('Accept Job?', `Pickup: ${item.pickupZone}\nDrop: ${item.dropZone}\nYour earning: $${Number(item.driverEarning).toFixed(2)}`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Accept', onPress: () => acceptMutation.mutate(item.id) },
              ])
            }
            disabled={acceptMutation.isPending}
          >
            {acceptMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.acceptText}>Accept Job</Text>
            )}
          </Pressable>
        </View>
      );
    },
    [acceptMutation],
  );

  if (query.isPending && !query.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Looking for jobs…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(item: { id: string }) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      ListHeaderComponent={
        <View style={styles.heroBar}>
          <Text style={styles.heroTitle}>Available Jobs</Text>
          <Text style={styles.heroSub}>Broadcast in your zone • Updates every 20s</Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>No jobs available right now. Pull to refresh.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  heroBar: { backgroundColor: Brand.navy, borderRadius: 16, padding: 20, marginBottom: 16 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  distBadge: { backgroundColor: Brand.pageBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  distText: { fontSize: 12, fontWeight: '700', color: Brand.blue },
  radiusBadge: { backgroundColor: '#EBF5FB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  radiusText: { fontSize: 12, fontWeight: '700', color: Brand.blue },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  earning: { fontSize: 20, fontWeight: '900', color: Brand.green },
  zones: { fontSize: 17, fontWeight: '800', color: Brand.navy, marginBottom: 4 },
  fee: { fontSize: 13, color: Brand.muted, marginBottom: 14 },
  acceptBtn: { backgroundColor: Brand.blue, borderRadius: 10, padding: 14, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  acceptText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: Brand.muted, marginTop: 10 },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 24 },
});
