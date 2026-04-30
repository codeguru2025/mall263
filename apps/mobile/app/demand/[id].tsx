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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { openOfferChatRoom } from '@/lib/chat-api';
import { acceptOffer, fetchDemandById, type DemandOfferDetail } from '@/lib/demands-api';
import { displayCity } from '@/lib/stalls-api';
import { fetchWalletBalance } from '@/lib/wallet-api';
import { getApiErrorMessage } from '@/lib/api-errors';
import { formatMoney } from '@/lib/products';
import { OfferCountdownRing } from '@/components/OfferCountdownRing';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 10 }
    : { elevation: 3 };

/** Initials from a stall name for the avatar fallback */
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** Avatar background colours — deterministic from stall id */
const AVATAR_COLORS = ['#16a34a', '#2563eb', '#7c3aed', '#db2777', '#d97706', '#0891b2'];
function avatarColor(id: string) {
  const hash = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
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

  const walletQ = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: fetchWalletBalance,
  });

  const acceptMut = useMutation({
    mutationFn: (offerId: string) => acceptOffer(offerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['demand', id] });
      await queryClient.invalidateQueries({ queryKey: ['my-demands'] });
      Alert.alert('Accepted ✓', 'Other offers were declined and this demand is matched.');
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
    nav.setOptions({ title: t && t.length > 32 ? `${t.slice(0, 30)}…` : t || 'Demand' });
  }, [d?.title, nav]);

  const confirmAccept = useCallback(
    (offer: DemandOfferDetail) => {
      const stall = offer.stall?.name ?? 'Seller';
      const price = formatMoney(offer.totalPrice, currency);
      const minRequired = 1;
      const available = walletQ.data != null ? Number(walletQ.data.available) : null;
      if (available != null && !isNaN(available) && available + 1e-9 < minRequired) {
        Alert.alert(
          'Add funds first',
          `You need at least ${formatMoney(minRequired, currency)} in your wallet. Available: ${formatMoney(available, currency)}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Fund wallet', onPress: () => router.push('/deposit') },
          ],
        );
        return;
      }
      Alert.alert(
        'Accept this offer?',
        `${stall} — ${price}\n\nYou can only accept one offer.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Accept', style: 'default', onPress: () => acceptMut.mutate(offer.id) },
        ],
      );
    },
    [acceptMut, currency, router, walletQ.data],
  );

  if (!id) return <View style={s.centered}><Text style={s.error}>Missing demand.</Text></View>;

  if (q.isPending) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={s.muted}>Loading…</Text>
      </View>
    );
  }

  if (q.isError || !d) {
    return (
      <View style={s.centered}>
        <Text style={s.error}>Demand not found or failed to load.</Text>
        <Pressable style={s.retry} onPress={() => q.refetch()}><Text style={s.retryText}>Retry</Text></Pressable>
      </View>
    );
  }

  const offers = d.offers ?? [];
  const pendingCount = offers.filter((o) => o.status === 'PENDING').length;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.body}>
      {/* ── Demand header ───────────────────────────────── */}
      <View style={[s.demandCard, cardShadow]}>
        <View style={s.demandRow}>
          <View style={s.demandStatusPill}>
            <Text style={s.demandStatusText}>{d.status.replace(/_/g, ' ')}</Text>
          </View>
          {d.urgency && (
            <View style={[s.demandStatusPill, { backgroundColor: d.urgency === 'HIGH' ? '#fff7ed' : '#f0fdf4' }]}>
              <Text style={[s.demandStatusText, { color: d.urgency === 'HIGH' ? Brand.orange : Brand.green }]}>
                {d.urgency} urgency
              </Text>
            </View>
          )}
        </View>
        <Text style={s.demandTitle}>{d.title}</Text>
        {d.description ? <Text style={s.demandDesc}>{d.description}</Text> : null}
        <View style={s.demandMeta}>
          <FontAwesome name="dollar" size={13} color={Brand.muted} />
          <Text style={s.demandBudget}>
            Budget: {d.minBudget != null ? `${formatMoney(d.minBudget, currency)} – ` : ''}
            {formatMoney(d.maxBudget, currency)}
          </Text>
        </View>
        {d.deliveryLocation ? (
          <View style={s.demandMeta}>
            <FontAwesome name="map-marker" size={13} color={Brand.muted} />
            <Text style={s.demandMetaText}>{d.deliveryLocation}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Offers section ──────────────────────────────── */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Offers</Text>
        <View style={s.offerCountPill}>
          <Text style={s.offerCountText}>{offers.length}</Text>
        </View>
      </View>

      {d.status === 'OPEN' && pendingCount > 1 ? (
        <View style={s.competingBanner}>
          <FontAwesome name="fire" size={14} color={Brand.orange} />
          <Text style={s.competingText}>
            {pendingCount} sellers are competing — accept before their offers expire!
          </Text>
        </View>
      ) : null}

      {offers.length === 0 ? (
        <View style={s.emptyWrap}>
          <FontAwesome name="clock-o" size={36} color={Brand.border} />
          <Text style={s.emptyTitle}>No offers yet</Text>
          <Text style={s.emptyDesc}>Sellers will appear here when they bid on your demand.</Text>
        </View>
      ) : (
        offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            currency={currency}
            demandOpen={d.status === 'OPEN'}
            acceptPending={acceptMut.isPending}
            chatPending={openChatMut.isPending}
            onAccept={() => confirmAccept(offer)}
            onChat={() => openChatMut.mutate(offer.id)}
            onDeliver={() =>
              router.push({
                pathname: '/delivery/checkout',
                params: {
                  orderId: offer.id,
                  orderType: 'OFFER',
                  pickupZone: displayCity(offer.stall?.mall?.city) || offer.stall?.name || 'Pickup',
                  dropZone: d.deliveryLocation?.trim() ? d.deliveryLocation.slice(0, 80) : 'Customer',
                  pickupAddress: offer.stall?.mall?.address ?? '',
                  dropAddress: d.deliveryLocation?.trim() || 'Add delivery address in demand details (not set)',
                  itemAmount: String(offer.totalPrice),
                },
              })
            }
          />
        ))
      )}

      <Pressable
        style={s.backBtn}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/demands' as never))}
      >
        <Text style={s.backBtnText}>← Back to list</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── OfferCard ────────────────────────────────────────────────────────────────

type OfferCardProps = {
  offer: DemandOfferDetail;
  currency: string;
  demandOpen: boolean;
  acceptPending: boolean;
  chatPending: boolean;
  onAccept: () => void;
  onChat: () => void;
  onDeliver: () => void;
};

function OfferCard({ offer, currency, demandOpen, acceptPending, chatPending, onAccept, onChat, onDeliver }: OfferCardProps) {
  const isPending = offer.status === 'PENDING';
  const isAccepted = offer.status === 'ACCEPTED';
  const isRejected = offer.status === 'REJECTED';

  const stallName = offer.stall?.name ?? 'Seller';
  const mallCity = [offer.stall?.mall?.name, displayCity(offer.stall?.mall?.city)].filter(Boolean).join(', ');
  const bgColor = avatarColor(offer.id);
  const items = offer.items ?? [];

  return (
    <View
      style={[
        s.offerCard,
        { borderColor: isAccepted ? '#16a34a' : isRejected ? Brand.border : Brand.border },
        isRejected && s.offerCardRejected,
        { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: isAccepted ? 0.1 : 0.06, shadowRadius: 8 },
        Platform.OS === 'android' && { elevation: isAccepted ? 3 : 2 },
      ]}
    >
      {/* ── Header row ── */}
      <View style={s.offerHeader}>
        {/* Left: countdown ring or status icon */}
        <View style={s.offerLeft}>
          {isPending && offer.createdAt && offer.expiresAt ? (
            <OfferCountdownRing createdAt={offer.createdAt} expiresAt={offer.expiresAt} />
          ) : (
            <View style={[s.statusIcon, { backgroundColor: isAccepted ? '#dcfce7' : '#f3f4f6' }]}>
              <FontAwesome
                name={isAccepted ? 'check-circle' : 'times-circle'}
                size={26}
                color={isAccepted ? '#16a34a' : Brand.muted}
              />
            </View>
          )}
        </View>

        {/* Centre: stall info */}
        <View style={s.offerMiddle}>
          <View style={s.stallRow}>
            {/* Avatar circle with initials */}
            <View style={[s.stallAvatar, { backgroundColor: bgColor }]}>
              <Text style={s.stallAvatarText}>{initials(stallName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.stallName} numberOfLines={1}>{stallName}</Text>
              {offer.stall?.stallNumber ? (
                <Text style={s.stallSub}>Stall #{offer.stall.stallNumber}</Text>
              ) : mallCity ? (
                <Text style={s.stallSub} numberOfLines={1}>
                  <FontAwesome name="map-marker" size={10} color={Brand.muted} /> {mallCity}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Status badge */}
          {isAccepted && (
            <View style={s.acceptedBadge}><Text style={s.acceptedBadgeText}>✓ Accepted</Text></View>
          )}
          {isRejected && (
            <View style={s.rejectedBadge}><Text style={s.rejectedBadgeText}>Rejected</Text></View>
          )}
        </View>

        {/* Right: price */}
        <View style={s.offerRight}>
          <Text style={[s.offerPrice, isAccepted && { color: '#16a34a' }]}>
            {formatMoney(offer.totalPrice, currency)}
          </Text>
        </View>
      </View>

      {/* ── Message ── */}
      {offer.message ? (
        <Text style={s.offerMessage} numberOfLines={3}>{offer.message}</Text>
      ) : null}

      {/* ── Line items ── */}
      {items.length > 0 && (
        <View style={s.itemsWrap}>
          {items.map((it, i) => {
            const name = it.variant?.product?.name ?? 'Item';
            return (
              <View key={i} style={s.itemRow}>
                <View style={s.itemDot} />
                <Text style={s.itemText}>
                  {name} <Text style={s.itemQty}>×{it.quantity}</Text>
                  {'  '}
                  <Text style={s.itemPrice}>{formatMoney(it.price, currency)}</Text>
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Action buttons ── */}
      <View style={s.actions}>
        {isPending && demandOpen && (
          <Pressable
            style={[s.acceptBtn, acceptPending && s.btnDisabled]}
            onPress={onAccept}
            disabled={acceptPending}
          >
            <FontAwesome name="check" size={14} color="#fff" />
            <Text style={s.acceptBtnText}>{acceptPending ? 'Accepting…' : 'Accept'}</Text>
          </Pressable>
        )}
        {isAccepted && (
          <>
            <Pressable
              style={[s.chatBtn, chatPending && s.btnDisabled]}
              onPress={onChat}
              disabled={chatPending}
            >
              <FontAwesome name="comment" size={13} color={Brand.blue} />
              <Text style={s.chatBtnText}>{chatPending ? 'Opening…' : 'Chat'}</Text>
            </Pressable>
            <Pressable style={s.deliverBtn} onPress={onDeliver}>
              <FontAwesome name="truck" size={13} color="#fff" />
              <Text style={s.deliverBtnText}>Delivery</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  body: { padding: 16, paddingBottom: 48 },

  // Demand header
  demandCard: {
    backgroundColor: Brand.card, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 20,
  },
  demandRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  demandStatusPill: {
    backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  demandStatusText: { fontSize: 10, fontWeight: '800', color: Brand.blue, textTransform: 'uppercase', letterSpacing: 0.4 },
  demandTitle: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginBottom: 8, lineHeight: 26 },
  demandDesc: { fontSize: 14, color: Brand.text, lineHeight: 21, marginBottom: 10 },
  demandMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  demandBudget: { fontSize: 15, fontWeight: '700', color: Brand.navy },
  demandMetaText: { fontSize: 13, color: Brand.text, fontWeight: '500' },

  // Section header
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: Brand.navy },
  offerCountPill: {
    backgroundColor: Brand.navy, borderRadius: 20, minWidth: 24,
    paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center',
  },
  offerCountText: { fontSize: 12, fontWeight: '900', color: '#fff' },

  // Competing banner
  competingBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fff7ed', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#fed7aa', marginBottom: 14,
  },
  competingText: { fontSize: 13, fontWeight: '700', color: Brand.orange, flex: 1, lineHeight: 18 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  emptyDesc: { fontSize: 13, color: Brand.muted, textAlign: 'center', lineHeight: 18 },

  // Offer card
  offerCard: {
    backgroundColor: Brand.card, borderRadius: 18,
    borderWidth: 1.5, marginBottom: 14, overflow: 'hidden',
  },
  offerCardRejected: { opacity: 0.5 },

  // Offer header (countdown + stall + price)
  offerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingBottom: 12 },
  offerLeft: { alignItems: 'center', justifyContent: 'center', width: 64, marginTop: 2 },
  statusIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  offerMiddle: { flex: 1 },
  offerRight: { alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 4 },

  // Stall avatar + name
  stallRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  stallAvatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stallAvatarText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  stallName: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  stallSub: { fontSize: 11, color: Brand.muted, marginTop: 1 },

  // Status badges
  acceptedBadge: {
    alignSelf: 'flex-start', backgroundColor: '#dcfce7',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
  },
  acceptedBadgeText: { fontSize: 10, fontWeight: '900', color: '#16a34a' },
  rejectedBadge: {
    alignSelf: 'flex-start', backgroundColor: '#f3f4f6',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
  },
  rejectedBadgeText: { fontSize: 10, fontWeight: '700', color: Brand.muted },

  // Price
  offerPrice: { fontSize: 22, fontWeight: '900', color: Brand.navy, letterSpacing: -0.5 },

  // Message
  offerMessage: {
    fontSize: 13, color: Brand.text, lineHeight: 20,
    paddingHorizontal: 16, paddingBottom: 10,
  },

  // Line items
  itemsWrap: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: Brand.pageBg, borderRadius: 10, padding: 10, gap: 5,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.muted, flexShrink: 0 },
  itemText: { fontSize: 12, color: Brand.text, flex: 1 },
  itemQty: { fontWeight: '700', color: Brand.navy },
  itemPrice: { color: Brand.navy, fontWeight: '700' },

  // Action buttons
  actions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 14,
  },
  acceptBtnText: { fontSize: 15, fontWeight: '900', color: '#fff' },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#eff6ff', borderRadius: 14, paddingVertical: 12,
    borderWidth: 1.5, borderColor: Brand.blue + '44',
  },
  chatBtnText: { fontSize: 14, fontWeight: '800', color: Brand.blue },
  deliverBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#0f766e', borderRadius: 14, paddingVertical: 12,
  },
  deliverBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.55 },

  // Navigation
  backBtn: {
    marginTop: 8, paddingVertical: 14, borderRadius: 14,
    borderWidth: 2, borderColor: Brand.border, alignItems: 'center',
  },
  backBtnText: { fontSize: 14, fontWeight: '700', color: Brand.navy },

  // Screen states
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700' },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
});
