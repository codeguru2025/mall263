import {
  ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { runsApi } from '@/lib/runs-api';
import { formatMoney } from '@/lib/products';

export default function SellerRunPinsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const qc = useQueryClient();

  const scanMut = useMutation({
    mutationFn: (token: string) => runsApi.scanQr(token),
    onSuccess: (data) => {
      setScannerOpen(false);
      setScanning(false);
      const items = data.items?.map((i) => `• ${i.name} — ${i.variant} ×${i.quantity}`).join('\n') ?? '';
      Alert.alert(
        'Goods confirmed',
        `${data.stall ? `Stall: ${data.stall}\n` : ''}${items}\n\n${data.message}`,
        [{ text: 'OK', onPress: () => qc.invalidateQueries({ queryKey: ['seller-run-stops'] }) }],
      );
    },
    onError: (err: any) => {
      setScanning(false);
      Alert.alert('Invalid QR', err?.response?.data?.message ?? 'Could not validate QR code');
    },
  });

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera required', 'Allow camera access to scan driver QR codes.');
        return;
      }
    }
    setScannerOpen(true);
    setScanning(false);
  };

  const handleBarCode = ({ data }: { data: string }) => {
    if (scanning || scanMut.isPending) return;
    setScanning(true);
    scanMut.mutate(data);
  };

  const q = useQuery({
    queryKey: ['seller-run-stops'],
    queryFn: runsApi.getStallStops,
    refetchInterval: 20_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  if (!q.isPending && scannerOpen) {
    return (
      <Modal visible animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={!scanMut.isPending ? handleBarCode : undefined}
          />
          <View style={styles.scanOverlay}>
            {scanMut.isPending
              ? <ActivityIndicator size="large" color="#fff" />
              : <Text style={styles.scanHint}>Point camera at driver's QR code</Text>
            }
          </View>
          <Pressable style={styles.closeScanBtn} onPress={() => setScannerOpen(false)}>
            <FontAwesome name="times" size={20} color="#fff" />
            <Text style={styles.closeScanText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  if (q.isPending && !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text style={styles.muted}>Loading PINs…</Text>
      </View>
    );
  }

  const stops: any[] = q.data ?? [];
  const pending = stops.filter((s) => s.status === 'PENDING');
  const done = stops.filter((s) => s.status === 'PICKED_UP');

  return (
    <FlatList
      data={stops}
      keyExtractor={(item: any) => item.id}
      renderItem={({ item }: { item: any }) => <StopPinCard stop={item} />}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headingRow}>
            <Text style={styles.heading}>Driver Pickups</Text>
            <Pressable style={styles.scanQrBtn} onPress={openScanner}>
              <FontAwesome name="qrcode" size={15} color="#fff" />
              <Text style={styles.scanQrText}>Scan Driver QR</Text>
            </Pressable>
          </View>
          <Text style={styles.subheading}>
            Scan the driver's QR code when they arrive, or show them the PIN below.
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{pending.length}</Text>
              <Text style={styles.statLabel}>Awaiting</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Brand.green }]}>{done.length}</Text>
              <Text style={styles.statLabel}>Collected</Text>
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <FontAwesome name="check-circle" size={40} color={Brand.border} />
          <Text style={styles.emptyTitle}>No pending pickups</Text>
          <Text style={styles.muted}>When a driver accepts a run that includes your stall, the PIN will appear here.</Text>
        </View>
      }
    />
  );
}

function StopPinCard({ stop }: { stop: any }) {
  const isDone = stop.status === 'PICKED_UP';
  const run = stop.run;

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      {/* Run info */}
      <View style={styles.cardHeader}>
        <View style={[styles.statusDot, { backgroundColor: isDone ? Brand.green : Brand.primary }]} />
        <Text style={styles.cardTitle}>{isDone ? 'Collected' : 'Awaiting driver'}</Text>
        <Text style={styles.runMode}>{run?.mode?.replace(/_/g, ' ')}</Text>
      </View>

      {/* Buyer info */}
      <Text style={styles.buyerName}>
        Buyer: {run?.buyer?.firstName} {run?.buyer?.lastName}
      </Text>
      <Text style={styles.dropZone}>Delivering to: {run?.dropZone}</Text>

      {/* Items */}
      <View style={styles.itemsList}>
        {stop.items?.map((item: any) => (
          <Text key={item.id} style={styles.itemText} numberOfLines={1}>
            • {item.variant?.product?.name} — {item.variant?.name} ×{item.quantity}
          </Text>
        ))}
      </View>

      {/* PIN */}
      {!isDone && stop.pickupPin && (
        <View style={styles.pinBox}>
          <Text style={styles.pinLabel}>Show driver this PIN</Text>
          <Text style={styles.pin}>{stop.pickupPin}</Text>
          <Text style={styles.pinNote}>The driver enters this in the app to confirm pickup.</Text>
        </View>
      )}

      {isDone && (
        <View style={styles.pickedUpBox}>
          <FontAwesome name="check-circle" size={14} color={Brand.green} />
          <Text style={styles.pickedUpText}>
            Picked up {stop.pickedUpAt ? new Date(stop.pickedUpAt).toLocaleString() : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { color: Brand.muted, fontSize: 13, marginTop: 8, textAlign: 'center' },
  list: { padding: 14, paddingBottom: 40 },

  header: { marginBottom: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  heading: { fontSize: 20, fontWeight: '900', color: Brand.navy },
  scanQrBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
  },
  scanQrText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  subheading: { fontSize: 13, color: Brand.muted, lineHeight: 18, marginBottom: 12 },

  scanOverlay: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' },
  scanHint: { color: '#fff', fontSize: 15, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: 10 },
  closeScanBtn: {
    position: 'absolute', top: 56, left: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
  },
  closeScanText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1, backgroundColor: Brand.card, borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: Brand.border,
  },
  statValue: { fontSize: 22, fontWeight: '900', color: Brand.navy },
  statLabel: { fontSize: 11, color: Brand.muted, marginTop: 2 },

  empty: { alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy },

  card: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Brand.border, ...cardShadow,
  },
  cardDone: { borderColor: Brand.green + '50', backgroundColor: Brand.green + '06' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: Brand.navy },
  runMode: { fontSize: 11, color: Brand.muted, fontWeight: '600' },

  buyerName: { fontSize: 13, color: Brand.navy, fontWeight: '600', marginBottom: 2 },
  dropZone: { fontSize: 12, color: Brand.muted, marginBottom: 8 },

  itemsList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.border, paddingTop: 8, marginBottom: 10 },
  itemText: { fontSize: 12, color: '#475569', marginBottom: 3 },

  pinBox: {
    backgroundColor: Brand.primary + '10', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: Brand.primary + '40',
  },
  pinLabel: { fontSize: 11, color: Brand.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  pin: { fontSize: 40, fontWeight: '900', color: Brand.primary, letterSpacing: 12, marginBottom: 6 },
  pinNote: { fontSize: 11, color: Brand.muted, textAlign: 'center' },

  pickedUpBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickedUpText: { fontSize: 12, color: Brand.green, fontWeight: '600' },
});
