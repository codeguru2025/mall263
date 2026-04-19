import { useLayoutEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Brand } from '@/constants/brand';
import { openOfferChatRoom } from '@/lib/chat-api';
import { acceptOffer, fetchDemandById, type DemandOfferDetail } from '@/lib/demands-api';
import { getApiErrorMessage } from '@/lib/api-errors';
import { formatMoney } from '@/lib/products';
import { OfferExpiryBar } from '@/components/OfferExpiryBar';

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      }
    : { elevation: 2 };

function offerLines(offer: DemandOfferDetail, currency: string): string {
  const items = offer.items ?? [];
  if (!items.length) return '';
  return items
    .map((it) => {
      const name = it.variant?.product?.name ?? 'Item';
      return `${name} ×${it.quantity} @ ${formatMoney(it.price, currency)}`;
    })
    .join('\n');
}

export default function DemandDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const nav = useNavigation();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ['demand', id],
    queryFn: () => fetchDemandById(id!),
    enabled: !!id,
  });

  const acceptMut = useMutation({
    mutationFn: (offerId: string) => acceptOffer(offerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['demand', id] });
      await queryClient.invalidateQueries({ queryKey: ['my-demands'] });
      Alert.alert('Accepted', 'Other offers were declined and this demand is matched.');
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
          : 'Could not accept.';
      const text = Array.isArray(msg) ? msg.join('\n') : typeof msg === 'string' ? msg : 'Try again.';
      Alert.alert('Accept failed', text);
    },
  });

  const openChatMut = useMutation({
    mutationFn: (offerId: string) => openOfferChatRoom(offerId),
    onSuccess: (room) => {
      router.push({ pathname: '/chat/[roomId]', params: { roomId: room.id } });
    },
    onError: (err: unknown) => {
      Alert.alert('Chat unavailable', getApiErrorMessage(err, 'Could not open chat room.'));
    },
  });

  const d = q.data;
  const currency = d?.currency ?? 'USD';

  useLayoutEffect(() => {
    const t = d?.title?.trim();
    nav.setOptions({
      title: t && t.length > 32 ? `${t.slice(0, 30)}…` : t || 'Demand',
    });
  }, [d?.title, nav]);

  const confirmAccept = useCallback(
    (offer: DemandOfferDetail) => {
      const stall = offer.stall?.name ?? 'Seller';
      const price = formatMoney(offer.totalPrice, currency);
      Alert.alert('Accept this offer?', `${stall} — ${price}\n\nYou can only accept one offer.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => acceptMut.mutate(offer.id),
        },
      ]);
    },
    [acceptMut, currency],
  );

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing demand.</Text>
      </View>
    );
  }

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (q.isError || !d) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Demand not found or failed to load.</Text>
        <Pressable style={styles.retry} onPress={() => q.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const offers = d.offers ?? [];
  const pendingCount = offers.filter((o) => o.status === 'PENDING').length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={[styles.card, cardShadow]}>
        <Text style={styles.status}>{d.status.replace(/_/g, ' ')}</Text>
        <Text style={styles.title}>{d.title}</Text>
        {d.description ? <Text style={styles.desc}>{d.description}</Text> : null}
        <Text style={styles.budgetRow}>
          Budget: {d.minBudget != null ? `${formatMoney(d.minBudget, currency)} – ` : ''}
          {formatMoney(d.maxBudget, currency)}
        </Text>
        <Text style={styles.small}>Urgency: {d.urgency}</Text>
        {d.deliveryLocation ? (
          <Text style={styles.deliveryLocation}>📍 {d.deliveryLocation}</Text>
        ) : null}
      </View>

      <Text style={styles.section}>Offers ({offers.length})</Text>
      {d.status === 'OPEN' && pendingCount > 1 ? (
        <Text style={styles.competing}>
          {pendingCount} sellers competing — each offer has its own countdown. Act before they expire.
        </Text>
      ) : null}
      {offers.length === 0 ? (
        <Text style={styles.emptyOffers}>No offers yet. Sellers will appear here when they bid.</Text>
      ) : (
        offers.map((offer) => {
          const lines = offerLines(offer, currency);
          return (
          <View key={offer.id} style={[styles.card, cardShadow, styles.offerCard]}>
            <Text style={styles.stallName}>{offer.stall?.name ?? 'Stall'}</Text>
            {offer.stall?.stallNumber ? (
              <Text style={styles.small}>Stall #{offer.stall.stallNumber}</Text>
            ) : null}
            <Text style={styles.offerPrice}>{formatMoney(offer.totalPrice, currency)}</Text>
            {offer.message ? <Text style={styles.message}>{offer.message}</Text> : null}
            {lines ? <Text style={styles.lines}>{lines}</Text> : null}
            <Text style={styles.offerStatus}>Status: {offer.status}</Text>
            {offer.status === 'PENDING' && offer.createdAt && offer.expiresAt ? (
              <OfferExpiryBar createdAt={offer.createdAt} expiresAt={offer.expiresAt} />
            ) : null}
            {offer.status === 'ACCEPTED' ? (
              <Pressable
                style={[styles.chatBtn, openChatMut.isPending && styles.btnDisabled]}
                onPress={() => openChatMut.mutate(offer.id)}
                disabled={openChatMut.isPending}
              >
                <Text style={styles.chatBtnText}>{openChatMut.isPending ? 'Opening…' : 'Open chat'}</Text>
              </Pressable>
            ) : null}
            {offer.status === 'ACCEPTED' && offer.stall?.merchant?.userId && d.buyer?.id ? (
              <Pressable
                style={styles.deliveryBtn}
                onPress={() =>
                  router.push({
                    pathname: '/delivery/checkout',
                    params: {
                      orderId: offer.id,
                      orderType: 'OFFER',
                      sellerId: offer.stall!.merchant!.userId,
                      buyerId: d.buyer!.id,
                      pickupZone: offer.stall?.mall?.city ?? offer.stall?.name ?? 'Pickup',
                      dropZone: 'Customer',
                      pickupAddress: offer.stall?.mall?.address ?? '',
                      itemAmount: String(offer.totalPrice),
                      deliveryFee: '5',
                    },
                  })
                }
              >
                <Text style={styles.deliveryBtnText}>Arrange Delivery</Text>
              </Pressable>
            ) : null}
            {offer.status === 'PENDING' && d.status === 'OPEN' ? (
              <Pressable
                style={[styles.acceptBtn, acceptMut.isPending && styles.btnDisabled]}
                onPress={() => confirmAccept(offer)}
                disabled={acceptMut.isPending}
              >
                <Text style={styles.acceptBtnText}>{acceptMut.isPending ? '…' : 'Accept offer'}</Text>
              </Pressable>
            ) : null}
          </View>
          );
        })
      )}

      <Pressable style={styles.outline} onPress={() => router.back()}>
        <Text style={styles.outlineText}>Back to list</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  body: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 14,
  },
  offerCard: { marginBottom: 12 },
  status: { fontSize: 11, fontWeight: '800', color: Brand.blue, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginBottom: 8 },
  desc: { fontSize: 15, color: Brand.text, lineHeight: 22, marginBottom: 10 },
  budgetRow: { fontSize: 16, fontWeight: '700', color: Brand.navy },
  small: { fontSize: 13, color: Brand.muted, marginTop: 6 },
  deliveryLocation: { fontSize: 13, color: Brand.text, marginTop: 8, fontWeight: '600' },
  section: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginBottom: 10 },
  competing: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.orange,
    marginBottom: 12,
    lineHeight: 18,
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  emptyOffers: { fontSize: 14, color: Brand.muted, marginBottom: 16 },
  stallName: { fontSize: 17, fontWeight: '800', color: Brand.navy },
  offerPrice: { fontSize: 18, fontWeight: '900', color: Brand.blue, marginTop: 8 },
  message: { fontSize: 14, color: Brand.text, marginTop: 8, lineHeight: 20 },
  lines: { fontSize: 13, color: Brand.muted, marginTop: 8, lineHeight: 18 },
  offerStatus: { fontSize: 12, color: Brand.muted, marginTop: 10, fontWeight: '600' },
  chatBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: Brand.blue,
    backgroundColor: '#eff6ff',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  chatBtnText: { color: Brand.blue, fontWeight: '800', fontSize: 14 },
  acceptBtn: {
    marginTop: 14,
    backgroundColor: Brand.navy,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  deliveryBtn: {
    marginTop: 10,
    backgroundColor: '#0f766e',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  deliveryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  outline: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: Brand.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  outlineText: { fontSize: 15, fontWeight: '700', color: Brand.navy },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700' },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
});
