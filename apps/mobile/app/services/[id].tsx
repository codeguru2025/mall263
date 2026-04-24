import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { displayCity } from '@/lib/stalls-api';
import { fetchServiceListing } from '@/lib/services-api';
import { Brand } from '@/constants/brand';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 }
    : { elevation: 3 };

function formatFrom(value: unknown, currency?: string) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return `${currency ?? 'USD'} ${n.toFixed(2)}`;
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useQuery({
    queryKey: ['service-listing', id],
    queryFn: () => fetchServiceListing(id!),
    enabled: !!id,
  });

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.blue} />
      </View>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="exclamation-triangle" size={26} color={Brand.muted} />
        <Text style={styles.errTitle}>Couldn&apos;t load this service</Text>
        <Pressable onPress={() => q.refetch()} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const s = q.data;
  const priceLine = formatFrom(s.priceFrom, s.currency);
  const providerName = s.provider
    ? `${s.provider.firstName ?? ''} ${s.provider.lastName ?? ''}`.trim()
    : '';
  const mallLine = s.mall ? [s.mall.name, displayCity(s.mall.city)].filter(Boolean).join(' · ') : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.heroWrap}>
        {s.imageUrl ? (
          <Image source={{ uri: s.imageUrl }} style={styles.hero} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <FontAwesome name="briefcase" size={48} color={Brand.blue} />
          </View>
        )}
        {priceLine ? (
          <View style={styles.pricePill}>
            <Text style={styles.pricePillText}>from {priceLine}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, cardShadow]}>
        <Text style={styles.title}>{s.title}</Text>
        {s.category?.name ? <Text style={styles.categoryChip}>{s.category.name}</Text> : null}
        {s.description ? <Text style={styles.description}>{s.description}</Text> : null}
      </View>

      <View style={[styles.panel, cardShadow]}>
        <Text style={styles.panelLabel}>Provider</Text>
        <View style={styles.providerRow}>
          <View style={styles.avatarBox}>
            {s.provider?.avatarUrl ? (
              <Image
                source={{ uri: s.provider.avatarUrl }}
                style={styles.avatar}
                contentFit="cover"
                transition={160}
              />
            ) : (
              <FontAwesome name="user" size={20} color={Brand.blue} />
            )}
          </View>
          <View style={styles.providerText}>
            <Text style={styles.providerName} numberOfLines={1}>
              {providerName || 'Service Provider'}
            </Text>
            {s.stall?.name ? (
              <Text style={styles.providerMeta} numberOfLines={1}>{s.stall.name}</Text>
            ) : null}
            {mallLine ? (
              <View style={styles.mallRow}>
                <FontAwesome name="map-marker" size={11} color={Brand.muted} />
                <Text style={styles.providerMeta} numberOfLines={1}>{mallLine}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Pressable
        style={({ pressed }: { pressed: boolean }) => [styles.requestBtn, pressed && styles.requestBtnPressed]}
        onPress={() => router.push({ pathname: '/services/request/[listingId]', params: { listingId: s.id } })}
      >
        <FontAwesome name="paper-plane" size={15} color="#fff" />
        <Text style={styles.requestBtnText}>Request a quote</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  body: { padding: 14, paddingBottom: 40, gap: 12 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errTitle: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  retryBtn: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: Brand.blue },
  retryBtnText: { color: '#fff', fontWeight: '800' },

  heroWrap: { borderRadius: 18, overflow: 'hidden', position: 'relative' },
  hero: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#f1f5f9' },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f1fb',
  },
  pricePill: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: Brand.blue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pricePillText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  panel: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  title: { fontSize: 20, fontWeight: '900', color: Brand.navy, letterSpacing: -0.3 },
  categoryChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#eff6fc',
    color: Brand.blue,
    fontWeight: '800',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  description: { marginTop: 10, fontSize: 14, color: Brand.text, lineHeight: 20 },

  panelLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e6f1fb',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  providerText: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  providerMeta: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  mallRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },

  requestBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  requestBtnPressed: { opacity: 0.88 },
  requestBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
