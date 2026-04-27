import { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { useRunCart } from '@/contexts/RunCartContext';
import { runsApi, type RunMode, type PickupPoint } from '@/lib/runs-api';
import { formatMoney } from '@/lib/products';

const RATE_PER_KM = 0.8;
const BASE_FEE = 1.0;

const MODES: { key: RunMode; label: string; desc: string }[] = [
  { key: 'SAFE_PAY', label: 'Safe Pay', desc: 'Funds held until delivery confirmed' },
  { key: 'CASH_ON_DELIVERY', label: 'Cash on Delivery', desc: 'Pay driver cash at your door' },
];

type DeliveryType = 'home' | 'pickup';

export default function PostRunScreen() {
  const router = useRouter();
  const { stops, totalAmount, clear } = useRunCart();

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('home');
  const [selectedPickupPoint, setSelectedPickupPoint] = useState<PickupPoint | null>(null);
  const [dropZone, setDropZone] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [mode, setMode] = useState<RunMode>('SAFE_PAY');

  const pickupPointsQ = useQuery({
    queryKey: ['pickup-points'],
    queryFn: runsApi.getPickupPoints,
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: () =>
      runsApi.create({
        mode,
        ...(deliveryType === 'pickup' && selectedPickupPoint
          ? { pickupPointId: selectedPickupPoint.id }
          : { dropZone: dropZone.trim(), dropAddress: dropAddress.trim() || undefined }),
        maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
        stops: stops.map((s, idx) => ({
          stallId: s.stallId,
          stopOrder: idx + 1,
          items: s.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        })),
      }),
    onSuccess: (run) => {
      router.replace({ pathname: '/runs/[runId]' as never, params: { runId: run.id } } as never);
      // Clear after navigation so cart survives a navigation failure
      setTimeout(clear, 300);
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not post the run. Try again.');
    },
  });

  const canPost = stops.length >= 2 && (
    deliveryType === 'pickup' ? !!selectedPickupPoint : dropZone.trim().length > 0
  );

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Stops summary */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Pickup stops ({stops.length})</Text>
          {stops.map((s, i) => (
            <View key={s.stallId} style={styles.stopRow}>
              <View style={styles.stopBadge}><Text style={styles.stopBadgeText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName}>{s.stallName}</Text>
                <Text style={styles.stopZone}>{s.zone}</Text>
                <Text style={styles.stopItemCount}>{s.items.length} item type(s)</Text>
              </View>
              <Text style={styles.stopAmount}>{formatMoney(s.items.reduce((n, i) => n + i.unitPrice * i.quantity, 0), 'USD')}</Text>
            </View>
          ))}
        </View>

        {/* Delivery type */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Delivery type</Text>
          {(['home', 'pickup'] as DeliveryType[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.modeRow, deliveryType === t && styles.modeRowActive]}
              onPress={() => setDeliveryType(t)}
            >
              <View style={[styles.modeRadio, deliveryType === t && styles.modeRadioActive]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.modeLabel, deliveryType === t && styles.modeLabelActive]}>
                  {t === 'home' ? 'Home delivery' : 'Pickup point'}
                </Text>
                <Text style={styles.modeDesc}>
                  {t === 'home'
                    ? 'Driver delivers to your door'
                    : 'Driver drops off at a named collection point; you collect at your convenience'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Home drop-off fields */}
        {deliveryType === 'home' && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Drop-off location</Text>
            <Text style={styles.fieldLabel}>Area / zone *</Text>
            <TextInput
              style={styles.input}
              value={dropZone}
              onChangeText={setDropZone}
              placeholder="e.g. Avondale, Harare"
              placeholderTextColor={Brand.muted}
            />
            <Text style={styles.fieldLabel}>Full address (optional)</Text>
            <TextInput
              style={styles.input}
              value={dropAddress}
              onChangeText={setDropAddress}
              placeholder="Street address shown to driver after they accept"
              placeholderTextColor={Brand.muted}
            />
          </View>
        )}

        {/* Pickup point selector */}
        {deliveryType === 'pickup' && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Choose pickup point</Text>
            {pickupPointsQ.isPending && <ActivityIndicator color={Brand.primary} style={{ marginVertical: 12 }} />}
            {pickupPointsQ.isError && <Text style={styles.hint}>Could not load pickup points. Try again.</Text>}
            {(pickupPointsQ.data ?? []).map((pp) => (
              <Pressable
                key={pp.id}
                style={[styles.modeRow, selectedPickupPoint?.id === pp.id && styles.modeRowActive]}
                onPress={() => setSelectedPickupPoint(pp)}
              >
                <View style={[styles.modeRadio, selectedPickupPoint?.id === pp.id && styles.modeRadioActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeLabel, selectedPickupPoint?.id === pp.id && styles.modeLabelActive]}>{pp.name}</Text>
                  <Text style={styles.modeDesc}>{pp.address}</Text>
                </View>
                <FontAwesome name="map-marker" size={14} color={Brand.muted} />
              </Pressable>
            ))}
            {!pickupPointsQ.isPending && (pickupPointsQ.data ?? []).length === 0 && (
              <Text style={styles.hint}>No pickup points available.</Text>
            )}
          </View>
        )}

        {/* Payment mode */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Payment mode</Text>
          {MODES.map((m) => (
            <Pressable
              key={m.key}
              style={[styles.modeRow, mode === m.key && styles.modeRowActive]}
              onPress={() => setMode(m.key)}
            >
              <View style={[styles.modeRadio, mode === m.key && styles.modeRadioActive]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.modeLabel, mode === m.key && styles.modeLabelActive]}>{m.label}</Text>
                <Text style={styles.modeDesc}>{m.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Budget */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Max delivery budget (optional)</Text>
          <TextInput
            style={styles.input}
            value={maxBudget}
            onChangeText={setMaxBudget}
            placeholder="Drivers won't bid above this amount"
            placeholderTextColor={Brand.muted}
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>
            Suggested fee guide: ${BASE_FEE.toFixed(2)} base + ${RATE_PER_KM}/km.
            Drivers set their own rates — you pick the best offer.
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items total</Text>
            <Text style={styles.summaryValue}>{formatMoney(totalAmount, 'USD')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery fee</Text>
            <Text style={styles.summaryValue}>Drivers will bid</Text>
          </View>
          <Text style={styles.summaryNote}>
            Post the run → drivers see your route and compete with offers → you accept the best one.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.postBtn, (!canPost || create.isPending) && styles.postBtnDisabled]}
          disabled={!canPost || create.isPending}
          onPress={() => create.mutate()}
          android_ripple={{ color: '#ffffff33' }}
        >
          {create.isPending
            ? <ActivityIndicator color="#fff" />
            : <>
                <FontAwesome name="truck" size={16} color="#fff" />
                <Text style={styles.postBtnText}>Post run — let drivers bid</Text>
              </>
          }
        </Pressable>
        {!canPost && (
          <Text style={styles.validationHint}>
            {stops.length < 2
              ? 'Add items from at least 2 different shops.'
              : deliveryType === 'pickup'
              ? 'Select a pickup point.'
              : 'Enter a drop-off area.'}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 14, paddingBottom: 120 },
  card: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Brand.navy, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: Brand.navy,
    fontSize: 14, backgroundColor: Brand.pageBg,
  },
  hint: { fontSize: 11, color: Brand.muted, marginTop: 8, lineHeight: 16 },

  stopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stopBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stopBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stopName: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  stopZone: { fontSize: 11, color: Brand.muted },
  stopItemCount: { fontSize: 11, color: Brand.muted },
  stopAmount: { fontSize: 13, fontWeight: '800', color: Brand.primary },

  modeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border, marginBottom: 8,
    backgroundColor: Brand.pageBg,
  },
  modeRowActive: { borderColor: Brand.primary, backgroundColor: Brand.primary + '08' },
  modeRadio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: Brand.border,
  },
  modeRadioActive: { borderColor: Brand.primary, backgroundColor: Brand.primary },
  modeLabel: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  modeLabelActive: { color: Brand.primary },
  modeDesc: { fontSize: 12, color: Brand.muted, marginTop: 1 },

  summaryCard: {
    backgroundColor: Brand.navy + '08', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Brand.navy + '20',
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14, color: Brand.muted, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  summaryNote: { fontSize: 11, color: Brand.muted, marginTop: 8, lineHeight: 16 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Brand.card, padding: 14, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: Brand.border,
  },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Brand.primary, paddingVertical: 14, borderRadius: 12,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  validationHint: { textAlign: 'center', fontSize: 12, color: Brand.red, marginTop: 8 },
});
