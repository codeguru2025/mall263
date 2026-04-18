import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
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
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api } from '@/lib/api';
import { Brand } from '@/constants/brand';
import { formatMoney } from '@/lib/products';
import { isWishlisted, toggleWishlist } from '@/lib/wishlist';
import { recordView } from '@/lib/recently-viewed';

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      }
    : { elevation: 3 };

type ProductStall = {
  id?: string;
  name?: string;
  logoUrl?: string | null;
  mall?: { name?: string; city?: string } | null;
  merchant?: {
    businessName?: string;
    logoUrl?: string | null;
  } | null;
};

type ProductDetail = {
  id: string;
  name: string;
  description?: string | null;
  minPrice?: unknown;
  maxPrice?: unknown;
  currency?: string;
  images?: { url: string }[];
  stall?: ProductStall | null;
};

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hearted, setHearted] = useState(false);

  const q = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await api.get<ProductDetail>(`/api/v1/products/${id}`);
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (id) isWishlisted(id).then(setHearted);
  }, [id]);

  useEffect(() => {
    if (!q.data || !id) return;
    const p = q.data;
    const img = (p.images ?? [])[0]?.url ?? null;
    recordView({
      id,
      name: String(p.name ?? ''),
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      currency: (p.currency as string) || 'USD',
      imageUrl: img,
    });
  }, [q.data, id]);

  const onToggleWishlist = useCallback(async () => {
    if (!q.data || !id) return;
    const p = q.data;
    const img = (p.images ?? [])[0]?.url ?? null;
    const added = await toggleWishlist({
      id,
      name: String(p.name ?? ''),
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      currency: (p.currency as string) || 'USD',
      imageUrl: img,
    });
    setHearted(added);
  }, [q.data, id]);

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing product.</Text>
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

  if (q.isError || !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Product not found or failed to load.</Text>
      </View>
    );
  }

  const p = q.data;
  const name = String(p.name ?? '');
  const description = p.description != null ? String(p.description) : '';
  const minPrice = p.minPrice;
  const maxPrice = p.maxPrice;
  const currency = (p.currency as string) || 'USD';
  const images = p.images ?? [];
  const hero = images[0]?.url;

  const stall = p.stall ?? null;
  const stallId = stall?.id;
  const storeName = stall?.name || stall?.merchant?.businessName || 'Store';
  const storeLogo = stall?.logoUrl || stall?.merchant?.logoUrl || null;
  const mallLine = stall?.mall
    ? [stall.mall.name, stall.mall.city].filter(Boolean).join(' · ')
    : '';
  const storeLocked =
    typeof storeName === 'string' && storeName.includes('Fund wallet');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.heroWrap}>
        {hero ? (
          <Image
            source={{ uri: hero }}
            style={styles.hero}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
          />
        ) : (
          <View style={[styles.hero, styles.heroPh]}>
            <Text style={styles.heroLetter}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.pricePill}>
          <Text style={styles.pricePillText}>
            {formatMoney(minPrice, currency)}
            {String(minPrice) !== String(maxPrice)
              ? ` – ${formatMoney(maxPrice, currency)}`
              : ''}
          </Text>
        </View>
        <Pressable
          style={styles.heartBtn}
          onPress={onToggleWishlist}
          hitSlop={8}
          android_ripple={{ color: '#fee2e2', radius: 22, borderless: true }}
        >
          <FontAwesome name={hearted ? 'heart' : 'heart-o'} size={22} color={hearted ? Brand.red : Brand.muted} />
        </Pressable>
      </View>

      <View style={[styles.panel, cardShadow]}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.priceLine}>
          {formatMoney(minPrice, currency)}
          {String(minPrice) !== String(maxPrice)
            ? ` – ${formatMoney(maxPrice, currency)}`
            : ''}
        </Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}

        <Pressable
          style={({ pressed }: { pressed: boolean }) => [styles.wantBtn, pressed && styles.wantBtnPressed]}
          onPress={() => {
            const maxStr = typeof maxPrice === 'number' ? String(maxPrice) : typeof maxPrice === 'string' ? maxPrice : '';
            const minStr = typeof minPrice === 'number' ? String(minPrice) : typeof minPrice === 'string' ? minPrice : '';
            router.push({
              pathname: '/demand/new',
              params: {
                title: name,
                description: description || `Looking for "${name}" — see product for reference.`,
                maxBudget: maxStr,
                minBudget: minStr && minStr !== maxStr ? minStr : '',
              },
            });
          }}
          android_ripple={{ color: '#ffffff22' }}
        >
          <FontAwesome name="hand-o-up" size={16} color="#fff" />
          <Text style={styles.wantBtnText}>I want this — post a demand</Text>
        </Pressable>
        <Text style={styles.wantHint}>
          Sellers across the mall will see your request and send offers.
        </Text>
      </View>

      {stall ? (
        <View style={[styles.storePanel, cardShadow]}>
          <Text style={styles.storeLabel}>Sold by</Text>
          <View style={styles.storeRow}>
            <View style={styles.storeLogoBox}>
              {storeLogo && !storeLocked ? (
                <Image
                  source={{ uri: storeLogo }}
                  style={styles.storeLogoImg}
                  contentFit="cover"
                  transition={160}
                />
              ) : (
                <FontAwesome name="shopping-bag" size={22} color={Brand.blue} />
              )}
            </View>
            <View style={styles.storeText}>
              <Text style={styles.storeName} numberOfLines={1}>
                {storeName}
              </Text>
              {mallLine ? (
                <View style={styles.mallRow}>
                  <FontAwesome name="map-marker" size={11} color={Brand.muted} />
                  <Text style={styles.mallText} numberOfLines={1}>
                    {mallLine}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {stallId && !storeLocked ? (
            <Pressable
              style={({ pressed }: { pressed: boolean }) => [styles.visitBtn, pressed && styles.visitBtnPressed]}
              onPress={() =>
                router.push({ pathname: '/store/[stallId]', params: { stallId } })
              }
              android_ripple={{ color: '#ffffff22' }}
            >
              <FontAwesome name="shopping-bag" size={15} color="#fff" />
              <Text style={styles.visitBtnText}>Visit store</Text>
              <FontAwesome name="arrow-right" size={13} color="#fff" />
            </Pressable>
          ) : (
            <View style={styles.lockedBox}>
              <FontAwesome name="lock" size={13} color={Brand.muted} />
              <Text style={styles.lockedText}>
                Fund your wallet to unlock store details.
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  body: { paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Brand.pageBg,
  },
  muted: { marginTop: 10, color: Brand.muted, fontSize: 15 },
  error: { color: Brand.red, fontWeight: '700', fontSize: 15 },

  heroWrap: { paddingHorizontal: 16, paddingTop: 12, position: 'relative' },
  hero: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 380,
    borderRadius: 20,
    backgroundColor: Brand.border,
  },
  heroPh: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: '#f8fafc',
  },
  heroLetter: { fontSize: 64, fontWeight: '900', color: Brand.blue },
  pricePill: {
    position: 'absolute',
    left: 28,
    bottom: 14,
    backgroundColor: Brand.navy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pricePillText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  heartBtn: {
    position: 'absolute',
    top: 20,
    right: 28,
    backgroundColor: Brand.card,
    padding: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
  },

  panel: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Brand.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  title: { fontSize: 24, fontWeight: '900', color: Brand.navy, lineHeight: 30, letterSpacing: -0.3 },
  priceLine: { fontSize: 20, fontWeight: '800', color: Brand.blue, marginTop: 10 },
  desc: { fontSize: 15, color: '#334155', marginTop: 16, lineHeight: 23 },

  wantBtn: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Brand.blue,
    paddingVertical: 14,
    borderRadius: 12,
  },
  wantBtnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  wantBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  wantHint: { marginTop: 8, fontSize: 11, color: Brand.muted, textAlign: 'center' },

  storePanel: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: Brand.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  storeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeLogoBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Brand.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  storeLogoImg: { width: '100%', height: '100%' },
  storeText: { flex: 1, gap: 3 },
  storeName: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  mallRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mallText: { fontSize: 12, color: Brand.muted, fontWeight: '500' },

  visitBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Brand.navy,
    paddingVertical: 14,
    borderRadius: 12,
  },
  visitBtnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  visitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },

  lockedBox: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.pageBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  lockedText: { flex: 1, fontSize: 12, color: Brand.muted, fontWeight: '600' },
});
