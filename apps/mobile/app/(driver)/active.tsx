import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Brand } from '@/constants/brand';
import { confirmDelivery, confirmPickup, getMyJobs, type DeliveryJob } from '@/lib/delivery-api';
import { updateDriverLocation } from '@/lib/drivers-api';

const ACTIVE_STATUSES = ['ACCEPTED', 'PICKUP_CONFIRMED', 'IN_TRANSIT', 'DELIVERED'];

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED: 'Go to Pickup',
  PICKUP_CONFIRMED: 'In Transit',
  IN_TRANSIT: 'Mark Delivered',
  DELIVERED: 'Awaiting Buyer Confirmation',
};

export default function DriverActiveJobScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery<DeliveryJob[]>({
    queryKey: ['my-jobs'],
    queryFn: getMyJobs,
    refetchInterval: 15_000,
  });

  const activeJob = query.data?.find((j) => ACTIVE_STATUSES.includes(j.status));

  // Live GPS tracking — sends location to backend every 30s while job is active
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  useEffect(() => {
    if (!activeJob) {
      locationSub.current?.remove();
      locationSub.current = null;
      return;
    }
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 50 },
        (pos) => {
          updateDriverLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
        },
      );
    })();
    return () => {
      mounted = false;
      locationSub.current?.remove();
      locationSub.current = null;
    };
  }, [activeJob?.id]);

  const getGps = useCallback(async (): Promise<{ gpsLat: number; gpsLng: number }> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { gpsLat: 0, gpsLng: 0 };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { gpsLat: pos.coords.latitude, gpsLng: pos.coords.longitude };
  }, []);

  const pickupMutation = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error('No active job');
      const gps = await getGps();
      return confirmPickup(activeJob.id, { photoUrl: 'placeholder', ...gps });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-jobs'] }),
    onError: (err: unknown) =>
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed'),
  });

  const deliverMutation = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error('No active job');
      const gps = await getGps();
      return confirmDelivery(activeJob.id, { photoUrl: 'placeholder', ...gps });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-jobs'] }),
    onError: (err: unknown) =>
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  }, [query]);

  if (query.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  if (!activeJob) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      >
        <Text style={styles.emptyIcon}>🚚</Text>
        <Text style={styles.emptyTitle}>No active job</Text>
        <Text style={styles.emptyText}>Head to Available Jobs to accept a delivery.</Text>
      </ScrollView>
    );
  }

  const isPending = pickupMutation.isPending || deliverMutation.isPending;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
    >
      <View style={styles.statusBand}>
        <Text style={styles.statusLabel}>{activeJob.status.replace(/_/g, ' ')}</Text>
        <Text style={styles.statusMode}>{activeJob.mode.replace(/_/g, ' ')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Route</Text>
        <View style={styles.routeRow}>
          <View style={styles.routePoint}>
            <Text style={styles.routeIcon}>📦</Text>
            <Text style={styles.routeZone}>{activeJob.pickupZone}</Text>
            {activeJob.pickupAddress && <Text style={styles.routeAddr}>{activeJob.pickupAddress}</Text>}
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.routePoint}>
            <Text style={styles.routeIcon}>🏠</Text>
            <Text style={styles.routeZone}>{activeJob.dropZone}</Text>
            {activeJob.dropAddress && <Text style={styles.routeAddr}>{activeJob.dropAddress}</Text>}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Financials</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Your earning</Text>
          <Text style={[styles.infoValue, { color: Brand.green }]}>${Number(activeJob.driverEarning).toFixed(2)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Item amount</Text>
          <Text style={styles.infoValue}>${Number(activeJob.itemAmount).toFixed(2)}</Text>
        </View>
        {activeJob.mode === 'CASH_ON_DELIVERY' && (
          <View style={[styles.infoRow, styles.codAlert]}>
            <Text style={styles.infoLabel}>⚠ Collect cash from buyer</Text>
            <Text style={[styles.infoValue, { color: Brand.orange }]}>${Number(activeJob.itemAmount).toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Action button */}
      {activeJob.status === 'ACCEPTED' && (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: Brand.blue }, isPending && styles.disabled]}
          onPress={() =>
            Alert.alert('Confirm Pickup', 'Confirm you have collected the item from the seller?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Confirm Pickup', onPress: () => pickupMutation.mutate() },
            ])
          }
          disabled={isPending}
        >
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>✓ Confirm Pickup</Text>}
        </Pressable>
      )}

      {(activeJob.status === 'PICKUP_CONFIRMED' || activeJob.status === 'IN_TRANSIT') && (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: Brand.green }, isPending && styles.disabled]}
          onPress={() =>
            Alert.alert('Confirm Delivery', 'Confirm you have delivered the item to the buyer?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Confirm Delivery', onPress: () => deliverMutation.mutate() },
            ])
          }
          disabled={isPending}
        >
          {isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>✓ Mark Delivered</Text>}
        </Pressable>
      )}

      {activeJob.status === 'DELIVERED' && (
        <View style={styles.waitingBox}>
          <Text style={styles.waitingText}>Waiting for buyer to confirm receipt. Auto-confirmed in 24h.</Text>
        </View>
      )}

      <Pressable
        style={styles.viewDetailsBtn}
        onPress={() => router.push({ pathname: '/delivery/track/[jobId]', params: { jobId: activeJob.id } })}
      >
        <Text style={styles.viewDetailsText}>View Full Details</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.pageBg },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginBottom: 8 },
  emptyText: { fontSize: 15, color: Brand.muted, textAlign: 'center' },
  statusBand: { backgroundColor: Brand.navy, padding: 24, alignItems: 'center' },
  statusLabel: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statusMode: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: Brand.card,
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routePoint: { flex: 1, alignItems: 'center' },
  routeIcon: { fontSize: 24, marginBottom: 4 },
  routeZone: { fontSize: 15, fontWeight: '800', color: Brand.navy, textAlign: 'center' },
  routeAddr: { fontSize: 12, color: Brand.muted, textAlign: 'center', marginTop: 2 },
  arrow: { fontSize: 22, color: Brand.muted, alignSelf: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  infoLabel: { fontSize: 14, color: Brand.muted },
  infoValue: { fontSize: 14, fontWeight: '700', color: Brand.text },
  codAlert: { backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, marginTop: 4 },
  actionBtn: { margin: 16, marginBottom: 0, borderRadius: 14, padding: 18, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  actionText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  waitingBox: {
    margin: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  waitingText: { color: Brand.blue, fontWeight: '700', textAlign: 'center' },
  viewDetailsBtn: { margin: 16, borderRadius: 14, borderWidth: 2, borderColor: Brand.navy, padding: 16, alignItems: 'center' },
  viewDetailsText: { color: Brand.navy, fontWeight: '800', fontSize: 15 },
});
