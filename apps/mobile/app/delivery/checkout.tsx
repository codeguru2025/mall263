import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Brand } from '@/constants/brand';
import { createDeliveryJob, type DeliveryMode } from '@/lib/delivery-api';
import { fetchOfferDeliveryQuote } from '@/lib/demands-api';

interface ModeOption {
  mode: DeliveryMode;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
}

const ALL_MODES: ModeOption[] = [
  {
    mode: 'SAFE_PAY',
    label: 'SafePay Escrow',
    subtitle: 'Funds locked until delivery confirmed. Buyer protected.',
    icon: '🔒',
    color: Brand.blue,
  },
  {
    mode: 'CASH_ON_DELIVERY',
    label: 'Cash on Delivery',
    subtitle: 'Driver collects cash from buyer. Seller receives after remittance.',
    icon: '💵',
    color: Brand.green,
  },
  {
    mode: 'DIRECT_DEAL',
    label: 'Direct handover',
    subtitle: 'You meet the seller in person. No driver — job completes immediately for records.',
    icon: '🤝',
    color: Brand.muted,
  },
];

export default function DeliveryCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId: string;
    orderType: string;
    pickupZone: string;
    dropZone: string;
    pickupAddress?: string;
    dropAddress?: string;
    itemAmount: string;
    /** Fallback when not an offer (e.g. POS) — per-job fee string */
    deliveryFee?: string;
  }>();

  const [selected, setSelected] = useState<DeliveryMode>('SAFE_PAY');
  const [locStatus, setLocStatus] = useState<'pending' | 'ready'>('pending');
  const [buyerGps, setBuyerGps] = useState<{ lat: number; lng: number } | null>(null);

  const orderType = (params.orderType as 'OFFER' | 'POS_SALE') || 'OFFER';
  const isOfferFlow = orderType === 'OFFER';

  const modeOptions = useMemo(
    () => (isOfferFlow ? ALL_MODES.filter((m) => m.mode !== 'DIRECT_DEAL') : ALL_MODES),
    [isOfferFlow],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setBuyerGps(null);
        setLocStatus('ready');
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setBuyerGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        if (!cancelled) setBuyerGps(null);
      } finally {
        if (!cancelled) setLocStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const quoteQ = useQuery({
    queryKey: ['offer-delivery-quote', params.orderId, buyerGps?.lat, buyerGps?.lng, locStatus],
    queryFn: () =>
      fetchOfferDeliveryQuote(params.orderId, buyerGps ? { lat: buyerGps.lat, lng: buyerGps.lng } : undefined),
    enabled: isOfferFlow && !!params.orderId && locStatus === 'ready',
    staleTime: 60_000,
    retry: 2,
  });

  const deliveryFeeNum = isOfferFlow
    ? quoteQ.data?.deliveryFee
    : Number(params.deliveryFee ?? 0);
  const distanceKm = isOfferFlow ? quoteQ.data?.distanceKm : undefined;
  const estimateOnly = isOfferFlow && quoteQ.data?.estimateOnly;

  const itemAmount = Number(params.itemAmount || 0);
  const feeReady =
    !isOfferFlow || (quoteQ.isSuccess && typeof deliveryFeeNum === 'number' && !isNaN(deliveryFeeNum));

  const mutation = useMutation({
    mutationFn: () => {
      if (!feeReady) throw new Error('Delivery fee is not ready yet');
      if (isOfferFlow && quoteQ.isError) throw new Error('Could not load delivery price');

      const dFee = isOfferFlow ? (quoteQ.data!.deliveryFee as number) : Number(params.deliveryFee ?? 0);
      const q = quoteQ.data;

      return createDeliveryJob({
        orderId: params.orderId,
        orderType,
        mode: selected,
        pickupZone: params.pickupZone,
        dropZone: params.dropZone,
        pickupAddress: params.pickupAddress?.trim() || '',
        dropAddress: params.dropAddress?.trim() || '',
        itemAmount,
        deliveryFee: dFee,
        ...(q && isOfferFlow
          ? {
              distanceKm: q.distanceKm,
              pickupLat: q.pickupLat,
              pickupLng: q.pickupLng,
              dropLat: q.dropLat ?? undefined,
              dropLng: q.dropLng ?? undefined,
            }
          : {}),
      });
    },
    onSuccess: (job) => {
      router.replace({
        pathname: '/delivery/track/[jobId]',
        params: { jobId: job.id },
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create delivery job';
      Alert.alert('Error', msg);
    },
  });

  if (!params.orderId || !params.itemAmount) {
    return (
      <View style={styles.centerMsg}>
        <Text style={styles.muted}>Missing order details. Go back and try again.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Choose Delivery Mode</Text>
      <Text style={styles.sub}>
        Item total: ${itemAmount.toFixed(2)} ·{' '}
        {isOfferFlow && (quoteQ.isPending || locStatus === 'pending') ? (
          <Text>Calculating delivery…</Text>
        ) : isOfferFlow && quoteQ.isError ? (
          <Text style={styles.warn}>Could not load delivery fee</Text>
        ) : feeReady ? (
          <Text>
            Delivery: ${Number(deliveryFeeNum).toFixed(2)}
            {distanceKm != null ? ` · ~${distanceKm} km` : ''}
            {estimateOnly ? ' (rough estimate — enable location for accuracy)' : ''}
          </Text>
        ) : (
          <Text>Delivery: —</Text>
        )}
      </Text>
      {isOfferFlow && quoteQ.isError && (
        <View style={styles.errorBox}>
          <Text style={styles.warnBanner}>
            We could not load the delivery price. Check your connection, then try again.
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => quoteQ.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {modeOptions.map((opt) => (
        <Pressable
          key={opt.mode}
          style={[styles.modeCard, selected === opt.mode && { borderColor: opt.color, borderWidth: 2 }]}
          onPress={() => setSelected(opt.mode)}
        >
          <Text style={styles.modeIcon}>{opt.icon}</Text>
          <View style={styles.modeText}>
            <Text style={[styles.modeLabel, selected === opt.mode && { color: opt.color }]}>{opt.label}</Text>
            <Text style={styles.modeSub}>{opt.subtitle}</Text>
          </View>
          {selected === opt.mode && <Text style={[styles.check, { color: opt.color }]}>✓</Text>}
        </Pressable>
      ))}

      <Pressable
        style={[styles.confirm, (mutation.isPending || !feeReady) && styles.disabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending || !feeReady}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : !feeReady ? (
          <Text style={styles.confirmText}>
            {isOfferFlow && (locStatus === 'pending' || quoteQ.isPending) ? '…' : 'Confirm and create job'}
          </Text>
        ) : (
          <Text style={styles.confirmText}>Confirm and create job</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerMsg: { flex: 1, justifyContent: 'center', padding: 24 },
  root: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 20 },
  heading: { fontSize: 24, fontWeight: '900', color: Brand.navy, marginBottom: 4 },
  sub: { fontSize: 14, color: Brand.muted, marginBottom: 12 },
  warn: { color: Brand.orange },
  warnBanner: {
    fontSize: 13,
    color: Brand.orange,
    marginBottom: 16,
    lineHeight: 18,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 14,
  },
  modeIcon: { fontSize: 30 },
  modeText: { flex: 1 },
  modeLabel: { fontSize: 17, fontWeight: '800', color: Brand.navy },
  modeSub: { fontSize: 13, color: Brand.muted, marginTop: 2 },
  check: { fontSize: 20, fontWeight: '900' },
  confirm: {
    backgroundColor: Brand.blue,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  disabled: { opacity: 0.6 },
  confirmText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  muted: { color: Brand.muted, textAlign: 'center' },
  errorBox: { marginBottom: 12 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.navy,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '800' },
});
