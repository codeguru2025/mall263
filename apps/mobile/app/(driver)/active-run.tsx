import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import QRCodeBase from 'react-native-qrcode-svg';
// Type cast needed: react-native-qrcode-svg class components have React 18 compat issues
const QRCode = QRCodeBase as any;
import { Brand } from '@/constants/brand';
import { runsApi, type Run, type RunStop } from '@/lib/runs-api';
import { formatMoney } from '@/lib/products';
import { updateDriverLocation } from '@/lib/drivers-api';
import { api } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  LOCKED: Brand.primary,
  IN_PROGRESS: '#f59e0b',
  DELIVERED: Brand.green,
};

export default function DriverActiveRunScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const q = useQuery({
    queryKey: ['driver-active-run'],
    queryFn: runsApi.getDriverActiveRun,
    refetchInterval: 15_000,
  });

  // Live GPS tracking while run is active
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const run = q.data ?? null;

  useEffect(() => {
    if (!run || run.status === 'DELIVERED' || run.status === 'AT_PICKUP_POINT') {
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
        (pos) => updateDriverLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {}),
      );
    })();
    return () => {
      mounted = false;
      locationSub.current?.remove();
      locationSub.current = null;
    };
  }, [run?.id, run?.status]);

  const getGps = useCallback(async (): Promise<{ gpsLat?: number; gpsLng?: number }> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return {};
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { gpsLat: pos.coords.latitude, gpsLng: pos.coords.longitude };
    } catch {
      return {};
    }
  }, []);

  const [deliveryQrToken, setDeliveryQrToken] = useState<string | null>(null);
  const [deliveryQrVisible, setDeliveryQrVisible] = useState(false);

  const loadDeliveryQr = async () => {
    if (!run) return;
    try {
      const res = await runsApi.getDeliveryQr(run.id);
      setDeliveryQrToken(res.token);
      setDeliveryQrVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not load QR code');
    }
  };

  const deliver = useMutation({
    mutationFn: async (proofUrl?: string) => {
      const gps = await getGps();
      return runsApi.submitDelivery(run!.id, proofUrl, undefined, gps.gpsLat, gps.gpsLng);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-active-run'] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not confirm delivery'),
  });

  const captureDeliveryProof = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access required', 'Allow camera to take delivery proof photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: 'delivery.jpg', type: 'image/jpeg' } as any);
      const uploadRes = await api.post('/api/v1/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      deliver.mutate(uploadRes.data.cdnUrl);
    } catch {
      deliver.mutate(undefined);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  if (q.isPending && !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.primary} />
      </View>
    );
  }

  if (!run) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
      >
        <FontAwesome name="truck" size={48} color={Brand.border} />
        <Text style={styles.emptyTitle}>No active run</Text>
        <Text style={styles.emptyDesc}>Accept a bid from the Multi-Runs tab to start a run.</Text>
        <Pressable style={styles.browseBtn} onPress={() => router.back()}>
          <Text style={styles.browseBtnText}>Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const statusColor = STATUS_COLOR[run.status] ?? Brand.muted;
  const allPicked = run.stops.every((s) => s.status === 'PICKED_UP');
  const pendingStops = run.stops.filter((s) => s.status === 'PENDING');

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
      >
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor + '18', borderColor: statusColor + '40' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {run.status === 'LOCKED' ? 'Head to first pickup stop' :
               run.status === 'IN_PROGRESS' ? 'All items collected — deliver now' :
               'Delivered — waiting for buyer confirmation'}
            </Text>
            {run.agreedFee && (
              <Text style={styles.statusFee}>
                Your earning: {formatMoney(parseFloat(run.agreedFee ?? '0') * 0.95, 'USD')}
              </Text>
            )}
          </View>
        </View>

        {/* Buyer info */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Delivering to</Text>
          <Text style={styles.buyerName}>{run.buyer?.firstName ?? ''} {run.buyer?.lastName ?? ''}</Text>
          <View style={styles.dropRow}>
            <FontAwesome name="flag-checkered" size={14} color={Brand.green} />
            <Text style={styles.dropText}>{run.dropZone}{run.dropAddress ? ` · ${run.dropAddress}` : ''}</Text>
          </View>
          {run.totalDistanceKm && (
            <Text style={styles.distanceNote}>~{parseFloat(run.totalDistanceKm ?? '0').toFixed(1)} km total route</Text>
          )}
        </View>

        {/* Stops */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            Pickup stops — {run.stops.filter((s) => s.status === 'PICKED_UP').length}/{run.stops.length} done
          </Text>
          {run.stops.map((stop, i) => (
            <StopCard
              key={stop.id}
              stop={stop}
              index={i}
              runId={run.id}
              onPickupSuccess={() => qc.invalidateQueries({ queryKey: ['driver-active-run'] })}
              getGps={getGps}
            />
          ))}
        </View>

        {/* Delivery QR code modal */}
        <Modal visible={deliveryQrVisible} transparent animationType="fade" onRequestClose={() => setDeliveryQrVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setDeliveryQrVisible(false)}>
            <View style={styles.qrModal}>
              <Text style={styles.qrModalTitle}>Delivery QR Code</Text>
              <Text style={styles.qrModalSub}>Show this to the buyer to confirm receipt</Text>
              {deliveryQrToken && <QRCode value={deliveryQrToken} size={220} />}
              <Pressable style={styles.closeQrBtn} onPress={() => setDeliveryQrVisible(false)}>
                <Text style={styles.closeQrBtnText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Delivery options (when all stops picked up) */}
        {run.status === 'IN_PROGRESS' && allPicked && (
          <View style={styles.deliveryActions}>
            <Pressable style={[styles.deliverBtn, { flex: 1 }]} onPress={loadDeliveryQr}>
              <FontAwesome name="qrcode" size={18} color="#fff" />
              <Text style={styles.deliverBtnText}>Show Delivery QR</Text>
            </Pressable>
            <Pressable
              style={[styles.deliverProofBtn, deliver.isPending && { opacity: 0.6 }]}
              disabled={deliver.isPending}
              onPress={() => {
                Alert.alert(
                  'Confirm delivery',
                  'Take a photo proof and confirm delivery?',
                  [
                    { text: 'Skip photo', onPress: () => deliver.mutate(undefined) },
                    { text: 'Take photo', onPress: captureDeliveryProof },
                    { text: 'Cancel', style: 'cancel' },
                  ],
                );
              }}
            >
              {deliver.isPending
                ? <ActivityIndicator color="#fff" />
                : <>
                    <FontAwesome name="check-circle" size={18} color="#fff" />
                    <Text style={styles.deliverBtnText}>Mark Delivered</Text>
                  </>
              }
            </Pressable>
          </View>
        )}

        {/* Pending stops reminder */}
        {run.status === 'LOCKED' && pendingStops.length > 0 && (
          <View style={styles.hintCard}>
            <FontAwesome name="info-circle" size={14} color={Brand.primary} />
            <Text style={styles.hintText}>
              Show the QR code to the stall owner for each stop. They scan it to confirm handover. Alternatively use the 4-digit PIN.
            </Text>
          </View>
        )}

        {/* Delivered waiting state */}
        {run.status === 'DELIVERED' && (
          <View style={styles.waitingCard}>
            <FontAwesome name="clock-o" size={18} color={Brand.green} />
            <Text style={styles.waitingText}>
              Waiting for buyer to confirm receipt. Payment auto-releases in 24h if they don't respond.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StopCard({
  stop, index, runId, onPickupSuccess, getGps,
}: {
  stop: RunStop;
  index: number;
  runId: string;
  onPickupSuccess: () => void;
  getGps: () => Promise<{ gpsLat?: number; gpsLng?: number }>;
}) {
  const [pin, setPin] = useState('');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const isDone = stop.status === 'PICKED_UP';

  const pickup = useMutation({
    mutationFn: async () => {
      const gps = await getGps();
      return runsApi.confirmPickup(runId, stop.id, pin, gps.gpsLat, gps.gpsLng);
    },
    onSuccess: () => { setPin(''); onPickupSuccess(); },
    onError: (err: any) => Alert.alert('Pickup failed', err?.response?.data?.message ?? 'Incorrect PIN or network error'),
  });

  const proofMut = useMutation({
    mutationFn: async (photoUrl: string) => runsApi.uploadCollectionProof(runId, stop.id, photoUrl),
    onSuccess: () => Alert.alert('Proof uploaded', 'Collection proof sent to buyer.'),
    onError: (err: any) => Alert.alert('Upload failed', err?.response?.data?.message ?? 'Could not upload proof'),
  });

  const handleShowQr = async () => {
    if (qrToken) { setQrVisible(true); return; }
    setLoadingQr(true);
    try {
      const res = await runsApi.getStopQr(runId, stop.id);
      setQrToken(res.token);
      setQrVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not load QR code');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleCaptureProof = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access required', 'Allow camera to take collection proof.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: 'collection.jpg', type: 'image/jpeg' } as any);
      const uploadRes = await api.post('/api/v1/upload/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      proofMut.mutate(uploadRes.data.cdnUrl);
    } catch (err: any) {
      Alert.alert('Upload failed', 'Could not upload collection proof');
    }
  };

  return (
    <View style={[styles.stopCard, isDone && styles.stopCardDone]}>
      {/* QR Modal */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setQrVisible(false)}>
          <View style={styles.qrModal}>
            <Text style={styles.qrModalTitle}>Stop {index + 1} — Pickup QR</Text>
            <Text style={styles.qrModalSub}>{stop.stall.name}</Text>
            <Text style={styles.qrModalInstr}>Show to stall owner to confirm goods handover</Text>
            {qrToken && <QRCode value={qrToken} size={220} />}
            <Pressable style={styles.closeQrBtn} onPress={() => setQrVisible(false)}>
              <Text style={styles.closeQrBtnText}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.stopHeader}>
        <View style={[styles.stopBadge, isDone && styles.stopBadgeDone]}>
          {isDone
            ? <FontAwesome name="check" size={11} color="#fff" />
            : <Text style={styles.stopBadgeText}>{index + 1}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stopName}>{stop.stall.name}</Text>
          {stop.stall.address && <Text style={styles.stopAddr}>{stop.stall.address}</Text>}
          {stop.stall.phone && <Text style={styles.stopPhone}>{stop.stall.phone}</Text>}
        </View>
        <Text style={[styles.stopAmount, isDone && { color: Brand.green }]}>
          {formatMoney(parseFloat(stop.itemAmount ?? '0'), 'USD')}
        </Text>
      </View>

      {/* Items to collect */}
      <View style={styles.itemsList}>
        {stop.items.map((item) => (
          <Text key={item.id} style={styles.itemText} numberOfLines={1}>
            • {item.variant.product.name} — {item.variant.name} ×{item.quantity}
          </Text>
        ))}
      </View>

      {/* Pending: show QR + PIN options */}
      {!isDone && (
        <>
          <Pressable
            style={[styles.qrBtn, loadingQr && { opacity: 0.5 }]}
            disabled={loadingQr}
            onPress={handleShowQr}
          >
            {loadingQr
              ? <ActivityIndicator color="#fff" size="small" />
              : <><FontAwesome name="qrcode" size={16} color="#fff" /><Text style={styles.qrBtnText}>Show QR to Stall Owner</Text></>
            }
          </Pressable>
          <View style={styles.pinRow}>
            <TextInput
              style={styles.pinInput}
              value={pin}
              onChangeText={(t: string) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="Or enter 4-digit PIN"
              placeholderTextColor={Brand.muted}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Pressable
              style={[styles.pinBtn, (pickup.isPending || pin.length !== 4) && { opacity: 0.5 }]}
              disabled={pickup.isPending || pin.length !== 4}
              onPress={() => pickup.mutate()}
            >
              {pickup.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.pinBtnText}>Confirm</Text>
              }
            </Pressable>
          </View>
        </>
      )}

      {isDone && (
        <>
          <Text style={styles.pickedUpAt}>
            Picked up {stop.pickedUpAt ? new Date(stop.pickedUpAt).toLocaleTimeString() : ''}
          </Text>
          {/* Collection proof upload */}
          {!stop.collectionPhotoUrl && (
            <Pressable
              style={[styles.proofBtn, proofMut.isPending && { opacity: 0.5 }]}
              disabled={proofMut.isPending}
              onPress={handleCaptureProof}
            >
              {proofMut.isPending
                ? <ActivityIndicator color={Brand.primary} size="small" />
                : <><FontAwesome name="camera" size={13} color={Brand.primary} /><Text style={styles.proofBtnText}>Upload collection proof (sent to buyer)</Text></>
              }
            </Pressable>
          )}
          {stop.collectionPhotoUrl && (
            <View style={styles.proofDone}>
              <FontAwesome name="check-circle" size={12} color={Brand.green} />
              <Text style={styles.proofDoneText}>Collection proof uploaded</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 14, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Brand.navy, marginTop: 4 },
  emptyDesc: { fontSize: 13, color: Brand.muted, textAlign: 'center', lineHeight: 19 },
  browseBtn: { backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  browseBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
    borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, fontWeight: '800' },
  statusFee: { fontSize: 12, color: Brand.muted, marginTop: 2 },

  card: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 12, ...cardShadow,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  buyerName: { fontSize: 15, fontWeight: '800', color: Brand.navy, marginBottom: 8 },
  dropRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dropText: { flex: 1, fontSize: 13, fontWeight: '600', color: Brand.navy },
  distanceNote: { fontSize: 11, color: Brand.muted, marginTop: 4 },

  stopCard: {
    borderRadius: 12, borderWidth: 1, borderColor: Brand.border,
    marginBottom: 10, backgroundColor: Brand.pageBg, overflow: 'hidden',
  },
  stopCardDone: { borderColor: Brand.green + '60', backgroundColor: Brand.green + '08' },
  stopHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, paddingBottom: 8 },
  stopBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stopBadgeDone: { backgroundColor: Brand.green },
  stopBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stopName: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  stopAddr: { fontSize: 11, color: Brand.muted, marginTop: 1 },
  stopPhone: { fontSize: 11, color: Brand.primary, marginTop: 1 },
  stopAmount: { fontSize: 14, fontWeight: '800', color: Brand.primary },

  itemsList: { paddingHorizontal: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.border },
  itemText: { fontSize: 12, color: '#475569', marginTop: 4 },

  pinRow: { flexDirection: 'row', gap: 8, padding: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.border },
  pinInput: {
    flex: 1, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 20, fontWeight: '800',
    color: Brand.navy, backgroundColor: Brand.card, textAlign: 'center', letterSpacing: 8,
  },
  pinBtn: {
    flex: 2, backgroundColor: Brand.primary, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
  },
  pinBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  pickedUpAt: { fontSize: 11, color: Brand.green, fontWeight: '600', paddingHorizontal: 12, paddingBottom: 10 },

  deliveryActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  deliverBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12,
  },
  deliverProofBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.green, paddingVertical: 14, borderRadius: 12,
  },
  deliverBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  qrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 10,
    marginHorizontal: 12, marginBottom: 8, marginTop: 4,
  },
  qrBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  proofBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4,
  },
  proofBtnText: { fontSize: 12, color: Brand.primary, fontWeight: '600' },
  proofDone: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  proofDoneText: { fontSize: 12, color: Brand.green, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  qrModal: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center',
    margin: 24, gap: 10,
  },
  qrModalTitle: { fontSize: 17, fontWeight: '900', color: Brand.navy },
  qrModalSub: { fontSize: 14, fontWeight: '600', color: Brand.navy },
  qrModalInstr: { fontSize: 12, color: Brand.muted, textAlign: 'center', marginBottom: 8 },
  closeQrBtn: { backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 12 },
  closeQrBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  hintCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Brand.primary + '10', borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Brand.primary + '30',
  },
  hintText: { flex: 1, fontSize: 12, color: Brand.navy, lineHeight: 17 },

  waitingCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Brand.green + '10', borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Brand.green + '30',
  },
  waitingText: { flex: 1, fontSize: 13, color: Brand.navy, lineHeight: 18, fontWeight: '600' },
});
