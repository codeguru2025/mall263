import { useState } from 'react';
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
import { useMutation } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { createDeliveryJob, type DeliveryMode } from '@/lib/delivery-api';

interface ModeOption {
  mode: DeliveryMode;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
}

const MODES: ModeOption[] = [
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
    label: 'Direct Deal',
    subtitle: 'Meet seller in person. No platform involvement.',
    icon: '🤝',
    color: Brand.muted,
  },
];

export default function DeliveryCheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId: string;
    orderType: string;
    sellerId: string;
    buyerId: string;
    pickupZone: string;
    dropZone: string;
    pickupAddress?: string;
    dropAddress?: string;
    itemAmount: string;
    deliveryFee: string;
  }>();

  const [selected, setSelected] = useState<DeliveryMode>('SAFE_PAY');

  const mutation = useMutation({
    mutationFn: () =>
      createDeliveryJob({
        orderId: params.orderId,
        orderType: params.orderType as 'OFFER' | 'POS_SALE',
        sellerId: params.sellerId,
        buyerId: params.buyerId,
        mode: selected,
        pickupZone: params.pickupZone,
        dropZone: params.dropZone,
        pickupAddress: params.pickupAddress,
        dropAddress: params.dropAddress,
        itemAmount: Number(params.itemAmount),
        deliveryFee: Number(params.deliveryFee),
      }),
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

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Choose Delivery Mode</Text>
      <Text style={styles.sub}>
        Item total: ${Number(params.itemAmount || 0).toFixed(2)} · Delivery: ${Number(params.deliveryFee || 0).toFixed(2)}
      </Text>

      {MODES.map((opt) => (
        <Pressable
          key={opt.mode}
          style={[styles.modeCard, selected === opt.mode && { borderColor: opt.color, borderWidth: 2 }]}
          onPress={() => setSelected(opt.mode)}
        >
          <Text style={styles.modeIcon}>{opt.icon}</Text>
          <View style={styles.modeText}>
            <Text style={[styles.modeLabel, selected === opt.mode && { color: opt.color }]}>
              {opt.label}
            </Text>
            <Text style={styles.modeSub}>{opt.subtitle}</Text>
          </View>
          {selected === opt.mode && <Text style={[styles.check, { color: opt.color }]}>✓</Text>}
        </Pressable>
      ))}

      <Pressable
        style={[styles.confirm, mutation.isPending && styles.disabled]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmText}>Confirm &amp; Create Job</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 20 },
  heading: { fontSize: 24, fontWeight: '900', color: Brand.navy, marginBottom: 4 },
  sub: { fontSize: 14, color: Brand.muted, marginBottom: 24 },
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
});
