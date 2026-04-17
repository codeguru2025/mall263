import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { MapView, Circle, Marker, PROVIDER_GOOGLE } from '@/components/MapViewSafe';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { buyerConfirmReceipt, cancelJob, getJob, type DeliveryJob } from '@/lib/delivery-api';

const { width: SCREEN_W } = Dimensions.get('window');
const MAP_HEIGHT = 240;
const USE_GOOGLE = Constants.expoConfig?.extra?.mapProvider === 'google';

// Default region — Bulawayo, Zimbabwe
const DEFAULT_REGION = {
  latitude: -20.1325,
  longitude: 28.6262,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const STATUS_LABELS: Record<string, string> = {
  BROADCAST: 'Finding driver…',
  ACCEPTED: 'Driver en route to pickup',
  PICKUP_CONFIRMED: 'Item picked up',
  IN_TRANSIT: 'In transit to you',
  DELIVERED: 'Delivered — awaiting confirmation',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned to seller',
};

const STATUS_COLOR: Record<string, string> = {
  BROADCAST: Brand.muted,
  ACCEPTED: Brand.blue,
  PICKUP_CONFIRMED: Brand.blue,
  IN_TRANSIT: Brand.orange,
  DELIVERED: Brand.green,
  COMPLETED: Brand.green,
  CANCELLED: Brand.red,
  RETURNED: Brand.red,
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DeliveryMap({ job }: { job: DeliveryJob }) {
  const mapRef = useRef<any>(null);

  const driverLat = job.driver?.currentLat != null ? Number(job.driver.currentLat) : null;
  const driverLng = job.driver?.currentLng != null ? Number(job.driver.currentLng) : null;
  const hasDriverPos = driverLat != null && driverLng != null && !isNaN(driverLat) && !isNaN(driverLng);

  // Confirmed pickup GPS from driver photo
  const pickupLat = job.pickupGpsLat != null ? Number(job.pickupGpsLat) : null;
  const pickupLng = job.pickupGpsLng != null ? Number(job.pickupGpsLng) : null;
  const hasPickup = pickupLat != null && pickupLng != null;

  // Confirmed delivery GPS
  const deliveryLat = job.deliveryGpsLat != null ? Number(job.deliveryGpsLat) : null;
  const deliveryLng = job.deliveryGpsLng != null ? Number(job.deliveryGpsLng) : null;
  const hasDelivery = deliveryLat != null && deliveryLng != null;

  const region = hasDriverPos
    ? { latitude: driverLat!, longitude: driverLng!, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : hasPickup
    ? { latitude: pickupLat!, longitude: pickupLng!, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : DEFAULT_REGION;

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={USE_GOOGLE ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        region={hasDriverPos ? region : undefined}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Driver live position */}
        {hasDriverPos && (
          <Marker
            coordinate={{ latitude: driverLat!, longitude: driverLng! }}
            title={`Driver: ${job.driver?.user.firstName ?? ''}`}
            description={STATUS_LABELS[job.status] ?? job.status}
            pinColor={Brand.blue}
          />
        )}

        {/* Delivery radius circle around pickup — 10 km catchment */}
        {hasPickup && (
          <Circle
            center={{ latitude: pickupLat!, longitude: pickupLng! }}
            radius={10_000}
            strokeColor="rgba(59,154,225,0.6)"
            fillColor="rgba(59,154,225,0.08)"
            strokeWidth={2}
          />
        )}

        {/* Pickup confirmation spot */}
        {hasPickup && (
          <Marker
            coordinate={{ latitude: pickupLat!, longitude: pickupLng! }}
            title="Pickup point"
            description="10 km delivery zone"
            pinColor={Brand.orange}
          />
        )}

        {/* Delivery confirmation spot */}
        {hasDelivery && (
          <Marker
            coordinate={{ latitude: deliveryLat!, longitude: deliveryLng! }}
            title="Delivery point"
            description="Item dropped here"
            pinColor={Brand.green}
          />
        )}
      </MapView>

      {/* Legend */}
      <View style={styles.mapLegend}>
        {hasDriverPos && (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: Brand.blue }]} />
            <Text style={styles.legendText}>Driver</Text>
          </View>
        )}
        {hasPickup && (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: Brand.orange }]} />
            <Text style={styles.legendText}>Pickup</Text>
          </View>
        )}
        {hasDelivery && (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: Brand.green }]} />
            <Text style={styles.legendText}>Delivered</Text>
          </View>
        )}
        {hasPickup && (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(59,154,225,0.4)', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(59,154,225,0.8)' }]} />
            <Text style={styles.legendText}>10 km zone</Text>
          </View>
        )}
        {!hasDriverPos && !hasPickup && !hasDelivery && (
          <Text style={styles.legendText}>Waiting for driver location…</Text>
        )}
      </View>
    </View>
  );
}

export default function TrackJobScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  if (!jobId || typeof jobId !== 'string') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Invalid job link.</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const query = useQuery<DeliveryJob>({
    queryKey: ['delivery-job', jobId],
    queryFn: () => getJob(jobId),
    refetchInterval: 15_000,
  });

  const confirmMutation = useMutation({
    mutationFn: () => buyerConfirmReceipt(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-job', jobId] }),
    onError: (err: unknown) =>
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to confirm'),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => cancelJob(jobId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-job', jobId] }),
    onError: (err: unknown) =>
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel'),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  }, [query]);

  const handleCancel = () => {
    Alert.prompt(
      'Cancel Job',
      'Reason for cancellation:',
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Cancel Job', style: 'destructive', onPress: (r) => cancelMutation.mutate(r ?? 'No reason') },
      ],
      'plain-text',
    );
  };

  if (query.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load job.</Text>
        <Pressable style={styles.retryBtn} onPress={() => query.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const job = query.data;
  const statusColor = STATUS_COLOR[job.status] ?? Brand.muted;
  const canConfirm = job.status === 'DELIVERED';
  const canCancel = ['BROADCAST', 'ACCEPTED'].includes(job.status);
  const canDispute = ['DELIVERED', 'COMPLETED'].includes(job.status);
  const isActive = !['COMPLETED', 'CANCELLED', 'RETURNED'].includes(job.status);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Status hero */}
      <View style={[styles.heroBand, { backgroundColor: statusColor }]}>
        <Text style={styles.heroStatus}>{STATUS_LABELS[job.status] ?? job.status}</Text>
        <Text style={styles.heroMode}>{job.mode.replace(/_/g, ' ')}</Text>
        {isActive && <Text style={styles.heroHint}>Map refreshes every 15 s</Text>}
      </View>

      {/* Live map */}
      <DeliveryMap job={job} />

      {/* Driver info */}
      {job.driver && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driver</Text>
          <InfoRow label="Name" value={`${job.driver.user.firstName} ${job.driver.user.lastName}`} />
          <InfoRow label="Phone" value={job.driver.user.phone} />
          <InfoRow label="Tier" value={job.driver.tier} />
        </View>
      )}

      {/* Job info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Job details</Text>
        <InfoRow label="Pickup zone" value={job.pickupZone} />
        <InfoRow label="Drop zone" value={job.dropZone} />
        {job.pickupAddress ? <InfoRow label="Pickup address" value={job.pickupAddress} /> : null}
        {job.dropAddress ? <InfoRow label="Drop address" value={job.dropAddress} /> : null}
        <InfoRow label="Item amount" value={`$${Number(job.itemAmount).toFixed(2)}`} />
        <InfoRow label="Delivery fee" value={`$${Number(job.deliveryFee).toFixed(2)}`} />
        <InfoRow label="Platform fee" value={`$${Number(job.platformFee).toFixed(2)}`} />
      </View>

      {/* Escrow info */}
      {job.escrow && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>SafePay Escrow</Text>
          <InfoRow label="Status" value={job.escrow.status.replace(/_/g, ' ')} />
          <InfoRow label="Total held" value={`$${Number(job.escrow.totalHeld).toFixed(2)}`} />
        </View>
      )}

      {/* Dispute info */}
      {job.dispute && (
        <View style={[styles.card, styles.disputeCard]}>
          <Text style={styles.sectionTitle}>Dispute</Text>
          <InfoRow label="Status" value={job.dispute.status} />
          <InfoRow label="Reason" value={job.dispute.reason} />
        </View>
      )}

      {/* Actions */}
      {canConfirm && (
        <Pressable
          style={[styles.actionBtn, styles.confirmBtn, confirmMutation.isPending && styles.disabled]}
          onPress={() =>
            Alert.alert('Confirm Receipt', 'Have you received your item?', [
              { text: 'Cancel' },
              { text: 'Yes, Confirm', onPress: () => confirmMutation.mutate() },
            ])
          }
          disabled={confirmMutation.isPending}
        >
          {confirmMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>✓ Confirm Receipt</Text>
          )}
        </Pressable>
      )}

      {canDispute && !job.dispute && (
        <Pressable
          style={[styles.actionBtn, styles.disputeBtn]}
          onPress={() => router.push({ pathname: '/dispute/[jobId]', params: { jobId: job.id } })}
        >
          <Text style={styles.btnText}>⚠ Open Dispute</Text>
        </Pressable>
      )}

      {canCancel && (
        <Pressable
          style={[styles.actionBtn, styles.cancelBtn, cancelMutation.isPending && styles.disabled]}
          onPress={handleCancel}
          disabled={cancelMutation.isPending}
        >
          <Text style={styles.btnText}>Cancel Job</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.pageBg },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  heroBand: { padding: 24, alignItems: 'center' },
  heroStatus: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroMode: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  heroHint: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  mapContainer: {
    width: SCREEN_W,
    height: MAP_HEIGHT,
    backgroundColor: '#e2e8f0',
  },
  map: { width: '100%', height: '100%' },
  mapLegend: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Brand.navy, fontWeight: '600' },
  card: {
    backgroundColor: Brand.card,
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  disputeCard: { borderColor: Brand.red },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  infoLabel: { fontSize: 14, color: Brand.muted },
  infoValue: { fontSize: 14, fontWeight: '700', color: Brand.text, flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  actionBtn: { margin: 16, marginBottom: 0, borderRadius: 14, padding: 18, alignItems: 'center' },
  confirmBtn: { backgroundColor: Brand.green },
  disputeBtn: { backgroundColor: Brand.orange },
  cancelBtn: { backgroundColor: Brand.red },
  disabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  errorText: { color: Brand.red, fontWeight: '700', fontSize: 16 },
  retryBtn: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
});
