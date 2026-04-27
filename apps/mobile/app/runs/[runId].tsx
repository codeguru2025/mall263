import { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCodeBase from 'react-native-qrcode-svg';
const QRCode = QRCodeBase as any;
import { Brand } from '@/constants/brand';
import { runsApi, type RunBid } from '@/lib/runs-api';
import { formatMoney } from '@/lib/products';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open — accepting bids',
  LOCKED: 'Locked — driver assigned',
  IN_PROGRESS: 'In progress',
  DELIVERED: 'Delivered — confirm receipt',
  AT_PICKUP_POINT: 'Ready for collection',
  COLLECTED: 'Collected',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'In dispute',
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: Brand.blue,
  LOCKED: Brand.primary,
  IN_PROGRESS: '#f59e0b',
  DELIVERED: Brand.green,
  AT_PICKUP_POINT: Brand.green,
  COLLECTED: Brand.green,
  COMPLETED: Brand.green,
  CANCELLED: Brand.red,
  DISPUTED: Brand.red,
};

export default function RunDetailScreen() {
  const router = useRouter();
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['run', runId],
    queryFn: () => runsApi.getById(runId!),
    enabled: !!runId,
    refetchInterval: 10_000,
  });

  const acceptBid = useMutation({
    mutationFn: (bidId: string) => runsApi.acceptBid(runId!, bidId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run', runId] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not accept bid'),
  });

  const confirmReceipt = useMutation({
    mutationFn: () => runsApi.confirmReceipt(runId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run', runId] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not confirm receipt'),
  });

  const cancel = useMutation({
    mutationFn: () => runsApi.cancel(runId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run', runId] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not cancel'),
  });

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
        <Pressable style={styles.retryBtn} onPress={() => q.refetch()}><Text style={styles.retryBtnText}>Retry</Text></Pressable>
      </View>
    );
  }

  const run = q.data;
  const statusColor = STATUS_COLOR[run.status] ?? Brand.muted;
  const pendingBids = run.bids.filter((b) => b.status === 'PENDING');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Status banner */}
      <View style={[styles.statusBanner, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[run.status] ?? run.status}</Text>
      </View>

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
              <Text style={styles.stopItems}>{stop.items.length} item type(s) · {formatMoney(parseFloat(stop.itemAmount), 'USD')}</Text>
            </View>
            <Text style={[styles.stopStatus, stop.status === 'PICKED_UP' && styles.stopStatusDone]}>
              {stop.status === 'PICKED_UP' ? 'Picked up' : 'Pending'}
            </Text>
          </View>
        ))}
        <View style={styles.dropRow}>
          <FontAwesome name="flag-checkered" size={16} color={Brand.green} />
          <Text style={styles.dropText}>{run.dropZone}{run.dropAddress ? ` · ${run.dropAddress}` : ''}</Text>
        </View>
        {run.totalDistanceKm && (
          <Text style={styles.distanceNote}>~{parseFloat(run.totalDistanceKm).toFixed(1)} km total route</Text>
        )}
      </View>

      {/* Bids */}
      {run.status === 'OPEN' && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            Driver bids ({pendingBids.length} pending{run.suggestedFee ? ` · suggested ${formatMoney(parseFloat(run.suggestedFee), 'USD')}` : ''})
          </Text>
          {pendingBids.length === 0 && (
            <Text style={styles.emptyBids}>No bids yet. Drivers will see your run and place offers.</Text>
          )}
          {pendingBids.map((bid) => (
            <BidCard
              key={bid.id}
              bid={bid}
              onAccept={() => {
                Alert.alert(
                  'Accept bid',
                  `Accept delivery for ${formatMoney(parseFloat(bid.fee), 'USD')} from ${bid.driver.user.firstName}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Accept', onPress: () => acceptBid.mutate(bid.id) },
                  ],
                );
              }}
              accepting={acceptBid.isPending}
            />
          ))}
        </View>
      )}

      {/* Accepted bid summary */}
      {run.agreedFee && run.driver && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Assigned driver</Text>
          <View style={styles.driverRow}>
            <FontAwesome name="user-circle" size={32} color={Brand.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{run.driver.user.firstName} {run.driver.user.lastName}</Text>
              <Text style={styles.driverMeta}>
                {run.driver.tier} · ⭐ {parseFloat(run.driver.rating).toFixed(1)} · {run.driver.user.phone ?? ''}
              </Text>
            </View>
            <Text style={styles.agreedFee}>{formatMoney(parseFloat(run.agreedFee), 'USD')}</Text>
          </View>
        </View>
      )}

      {/* Confirm receipt */}
      {run.status === 'DELIVERED' && (
        <Pressable
          style={[styles.confirmBtn, confirmReceipt.isPending && { opacity: 0.7 }]}
          disabled={confirmReceipt.isPending}
          onPress={() => {
            Alert.alert('Confirm receipt', 'Confirm you received all items? Payment will be released to sellers and driver.', [
              { text: 'Not yet', style: 'cancel' },
              { text: 'Yes, confirm', onPress: () => confirmReceipt.mutate() },
            ]);
          }}
        >
          {confirmReceipt.isPending
            ? <ActivityIndicator color="#fff" />
            : <><FontAwesome name="check-circle" size={16} color="#fff" /><Text style={styles.confirmBtnText}>Confirm receipt</Text></>
          }
        </Pressable>
      )}

      {/* Collection QR — shown when order is at the pickup point */}
      {run.status === 'AT_PICKUP_POINT' && run.collectionToken && run.pickupPoint && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Show this QR at {run.pickupPoint.name}</Text>
          <View style={styles.qrWrapper}>
            <QRCode value={run.collectionToken} size={200} />
          </View>
          {run.collectionCode && (
            <View style={styles.collectionCodeRow}>
              <Text style={styles.collectionCodeLabel}>Code</Text>
              <Text style={styles.collectionCode}>{run.collectionCode}</Text>
            </View>
          )}
          <Text style={styles.qrHint}>
            Present this QR (or quote the code) to the pickup point operator to collect your order.
          </Text>
        </View>
      )}

      {run.status === 'COLLECTED' && (
        <View style={[styles.card, { alignItems: 'center', gap: 6 }]}>
          <FontAwesome name="check-circle" size={32} color={Brand.green} />
          <Text style={[styles.sectionLabel, { color: Brand.green }]}>Order collected</Text>
          {run.pickupPoint && <Text style={styles.distanceNote}>Collected from {run.pickupPoint.name}</Text>}
        </View>
      )}

      {/* Track button (active runs) */}
      {(run.status === 'LOCKED' || run.status === 'IN_PROGRESS') && (
        <Pressable
          style={styles.trackBtn}
          onPress={() => router.push({ pathname: '/runs/track/[runId]' as never, params: { runId: run.id } } as never)}
        >
          <FontAwesome name="map-marker" size={14} color={Brand.primary} />
          <Text style={styles.trackBtnText}>Track delivery</Text>
        </Pressable>
      )}

      {/* Cancel */}
      {(run.status === 'OPEN' || run.status === 'LOCKED') && (
        <Pressable
          style={styles.cancelBtn}
          disabled={cancel.isPending}
          onPress={() => {
            Alert.alert('Cancel run', 'Cancel this delivery run?', [
              { text: 'Keep it', style: 'cancel' },
              { text: 'Cancel run', style: 'destructive', onPress: () => cancel.mutate() },
            ]);
          }}
        >
          <Text style={styles.cancelBtnText}>{cancel.isPending ? 'Cancelling…' : 'Cancel run'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function BidCard({ bid, onAccept, accepting }: { bid: RunBid; onAccept: () => void; accepting: boolean }) {
  return (
    <View style={styles.bidCard}>
      <View style={styles.bidLeft}>
        <Text style={styles.bidDriver}>{bid.driver.user.firstName} {bid.driver.user.lastName}</Text>
        <Text style={styles.bidMeta}>
          {bid.driver.tier} · ⭐ {parseFloat(bid.driver.rating).toFixed(1)} · {bid.driver.completedJobs} jobs
        </Text>
        {bid.message ? <Text style={styles.bidMessage}>"{bid.message}"</Text> : null}
      </View>
      <View style={styles.bidRight}>
        <Text style={styles.bidFee}>{formatMoney(parseFloat(bid.fee), 'USD')}</Text>
        <Pressable
          style={[styles.acceptBtn, accepting && { opacity: 0.7 }]}
          disabled={accepting}
          onPress={onAccept}
        >
          <Text style={styles.acceptBtnText}>Accept</Text>
        </Pressable>
      </View>
    </View>
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

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '800' },

  card: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 12, ...cardShadow,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stopBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stopBadgeDone: { backgroundColor: Brand.green },
  stopBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stopInfo: { flex: 1 },
  stopName: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  stopItems: { fontSize: 11, color: Brand.muted },
  stopStatus: { fontSize: 12, color: Brand.muted, fontWeight: '600' },
  stopStatusDone: { color: Brand.green },

  dropRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.border },
  dropText: { flex: 1, fontSize: 13, fontWeight: '600', color: Brand.navy },
  distanceNote: { fontSize: 11, color: Brand.muted, marginTop: 6 },

  emptyBids: { fontSize: 13, color: Brand.muted, lineHeight: 18 },

  bidCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Brand.pageBg, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Brand.border,
  },
  bidLeft: { flex: 1 },
  bidDriver: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  bidMeta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  bidMessage: { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 4 },
  bidRight: { alignItems: 'flex-end', gap: 8 },
  bidFee: { fontSize: 18, fontWeight: '900', color: Brand.primary },
  acceptBtn: { backgroundColor: Brand.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverName: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  driverMeta: { fontSize: 12, color: Brand.muted },
  agreedFee: { fontSize: 18, fontWeight: '900', color: Brand.primary },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Brand.green, paddingVertical: 14, borderRadius: 12, marginBottom: 12,
  },
  confirmBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  cancelBtn: {
    alignItems: 'center', paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: Brand.red, marginBottom: 12,
  },
  cancelBtnText: { color: Brand.red, fontWeight: '700', fontSize: 14 },

  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Brand.primary + '40', backgroundColor: Brand.primary + '08',
  },
  trackBtnText: { color: Brand.primary, fontWeight: '700', fontSize: 14 },

  qrWrapper: { alignItems: 'center', paddingVertical: 16 },
  collectionCodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 8,
  },
  collectionCodeLabel: { fontSize: 12, color: Brand.muted, fontWeight: '600' },
  collectionCode: { fontSize: 22, fontWeight: '900', color: Brand.navy, letterSpacing: 2 },
  qrHint: { fontSize: 12, color: Brand.muted, textAlign: 'center', lineHeight: 18 },
});
