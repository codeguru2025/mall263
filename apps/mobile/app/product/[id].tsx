import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api } from '@/lib/api';
import { Brand } from '@/constants/brand';
import { formatMoney } from '@/lib/products';
import { isWishlisted, toggleWishlist } from '@/lib/wishlist';
import { recordView } from '@/lib/recently-viewed';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWalletBalance } from '@/lib/wallet-api';
import { displayCity } from '@/lib/stalls-api';

const { width: SCREEN_W } = Dimensions.get('window');

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12 }
    : { elevation: 3 };

type ProductVariant = {
  id: string;
  name: string;
  sku?: string | null;
  color?: string | null;
  size?: string | null;
  sellingPrice: unknown;
  costPrice?: unknown;
  isActive?: boolean;
  inventory?: { quantity: number } | null;
};

type ProductStall = {
  id?: string;
  name?: string;
  logoUrl?: string | null;
  mall?: { name?: string; city?: string } | null;
  merchant?: { businessName?: string; logoUrl?: string | null } | null;
};

type ProductDetail = {
  id: string;
  name: string;
  description?: string | null;
  brand?: string | null;
  minPrice?: unknown;
  maxPrice?: unknown;
  currency?: string;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  images?: { url: string }[];
  variants?: ProductVariant[];
  stall?: ProductStall | null;
};

async function recordEngagement(productId: string): Promise<void> {
  try {
    await api.post(`/api/v1/products/${productId}/view`);
  } catch {
    // Best-effort — never disrupt UI
  }
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [hearted, setHearted] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const engagedRef = useRef(false);

  const q = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await api.get<ProductDetail>(`/api/v1/products/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const reviewsQ = useQuery({
    queryKey: ['product-reviews', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/reviews/product/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const walletQ = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: fetchWalletBalance,
    enabled: isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });

  const isBuyer = !user?.role || user.role === 'BUYER';
  const subStatusQ = useQuery({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/subscriptions/status');
      return data as { fullyAccess: boolean; status: string };
    },
    enabled: isAuthenticated && isBuyer,
    staleTime: 60_000,
  });
  const buyerGated = isAuthenticated && isBuyer && subStatusQ.data && !subStatusQ.data.fullyAccess;

  const submitReview = useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/reviews', {
        productId: id,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        body: reviewBody.trim() || undefined,
      });
    },
    onSuccess: () => {
      setReviewTitle('');
      setReviewBody('');
      queryClient.invalidateQueries({ queryKey: ['product-reviews', id] });
    },
    onError: () => {
      Alert.alert('Review failed', 'Could not submit your review. You may already have one for this product.');
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (reviewId: string) => {
      await api.delete(`/api/v1/reviews/${reviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews', id] });
    },
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
    if (!engagedRef.current) {
      engagedRef.current = true;
      void recordEngagement(id);
    }
    // Auto-select first active variant
    const firstActive = (p.variants ?? []).find((v) => v.isActive !== false);
    if (firstActive) setSelectedVariantId(firstActive.id);
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
  const currency = (p.currency as string) || 'USD';
  const images = p.images ?? [];
  const activeVariants = (p.variants ?? []).filter((v) => v.isActive !== false);
  const selectedVariant = activeVariants.find((v) => v.id === selectedVariantId) ?? null;

  const displayPrice = selectedVariant
    ? formatMoney(selectedVariant.sellingPrice, currency)
    : `${formatMoney(p.minPrice, currency)}${String(p.minPrice) !== String(p.maxPrice) ? ` – ${formatMoney(p.maxPrice, currency)}` : ''}`;

  const selectedStock = selectedVariant?.inventory?.quantity ?? null;

  const stall = p.stall ?? null;
  const stallId = stall?.id;
  const storeName = stall?.name || stall?.merchant?.businessName || 'Store';
  const storeLogo = stall?.logoUrl || stall?.merchant?.logoUrl || null;
  const mallLine = stall?.mall
    ? [stall.mall.name, displayCity(stall.mall.city)].filter(Boolean).join(' · ')
    : '';
  const storeLocked = (typeof storeName === 'string' && storeName.includes('Fund wallet')) || !!buyerGated;

  const walletBalance = walletQ.data?.available;
  const walletCurrency = walletQ.data?.currency ?? 'USD';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      {/* Image carousel */}
      <View style={styles.carouselWrap}>
        {images.length > 0 ? (
          <>
            <FlatList
              data={images}
              keyExtractor={(_: { url: string }, i: number) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
                const idx = viewableItems[0]?.index ?? 0;
                setCarouselIndex(idx);
              }}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
              renderItem={({ item }: { item: { url: string } }) => (
                <Image
                  source={{ uri: item.url }}
                  style={styles.carouselImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={250}
                />
              )}
            />
            {images.length > 1 && (
              <View style={styles.dotRow}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === carouselIndex && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={[styles.carouselImg, styles.heroPh]}>
            <Text style={styles.heroLetter}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.pricePill}>
          <Text style={styles.pricePillText}>{displayPrice}</Text>
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
        <Text style={styles.priceLine}>{displayPrice}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}

        {/* Variant picker */}
        {activeVariants.length > 1 && (
          <View style={styles.variantSection}>
            <Text style={styles.variantLabel}>Variants</Text>
            <View style={styles.variantChips}>
              {activeVariants.map((v) => {
                const stock = v.inventory?.quantity ?? 0;
                const isSelected = v.id === selectedVariantId;
                return (
                  <Pressable
                    key={v.id}
                    style={[styles.variantChip, isSelected && styles.variantChipActive, stock === 0 && styles.variantChipOut]}
                    onPress={() => stock > 0 && setSelectedVariantId(v.id)}
                    disabled={stock === 0}
                  >
                    <Text style={[styles.variantChipText, isSelected && styles.variantChipTextActive]}>
                      {v.name}
                    </Text>
                    {stock === 0 && <Text style={styles.variantChipOutText}> (out)</Text>}
                  </Pressable>
                );
              })}
            </View>
            {selectedVariant && selectedStock !== null && (
              <Text style={styles.stockNote}>
                {selectedStock > 0 ? `${selectedStock} in stock` : 'Out of stock'}
              </Text>
            )}
          </View>
        )}

        {/* Wallet balance card */}
        {isAuthenticated && walletBalance !== undefined && (
          <View style={styles.walletCard}>
            <FontAwesome name="credit-card" size={14} color={Brand.blue} />
            <View style={{ flex: 1 }}>
              <Text style={styles.walletLabel}>Wallet balance</Text>
              <Text style={styles.walletAmount}>{formatMoney(walletBalance, walletCurrency)}</Text>
            </View>
            <Pressable
              style={styles.topUpBtn}
              onPress={() => router.push('/deposit' as never)}
            >
              <Text style={styles.topUpText}>Top up</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }: { pressed: boolean }) => [styles.wantBtn, pressed && styles.wantBtnPressed]}
          onPress={() => {
            const maxStr = typeof p.maxPrice === 'number' ? String(p.maxPrice) : typeof p.maxPrice === 'string' ? p.maxPrice : '';
            const minStr = typeof p.minPrice === 'number' ? String(p.minPrice) : typeof p.minPrice === 'string' ? p.minPrice : '';
            router.push({
              pathname: '/demand/new',
              params: {
                title: name,
                description: description || `Looking for "${name}" — see product for reference.`,
                maxBudget: maxStr,
                minBudget: minStr && minStr !== maxStr ? minStr : '',
                productId: id,
                brand: p.brand ?? '',
                categoryId: p.categoryId ?? p.category?.id ?? '',
                stallId: stallId ?? '',
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

      {buyerGated && (
        <View style={[styles.gateCard, cardShadow]}>
          <Text style={styles.gateIcon}>🔒</Text>
          <Text style={styles.gateTitle}>Subscribe to see seller details</Text>
          <Text style={styles.gateBody}>
            Your free trial has ended. Top up $1/month to see full product info, seller location, and contact details.
          </Text>
          <Pressable
            style={({ pressed }: { pressed: boolean }) => [styles.gateBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/subscriptions' as never)}
          >
            <FontAwesome name="lock" size={13} color="#fff" />
            <Text style={styles.gateBtnText}>Subscribe for $1/month</Text>
          </Pressable>
        </View>
      )}

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

      <View style={[styles.reviewPanel, cardShadow]}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>Reviews</Text>
          <Text style={styles.reviewAvg}>
            {reviewsQ.data?.avgRating ? `${Number(reviewsQ.data.avgRating).toFixed(1)} / 5` : 'No ratings yet'}
          </Text>
        </View>

        {reviewsQ.isPending ? (
          <Text style={styles.reviewMuted}>Loading reviews...</Text>
        ) : Array.isArray(reviewsQ.data?.data) && reviewsQ.data.data.length > 0 ? (
          <View style={styles.reviewList}>
            {reviewsQ.data.data.slice(0, 4).map((review: any) => {
              const reviewerName = `${review.reviewer?.firstName ?? ''} ${review.reviewer?.lastName ?? ''}`.trim() || 'User';
              const isMine = review.reviewerId === user?.id;
              return (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewCardHeader}>
                    <View>
                      <Text style={styles.reviewName}>{reviewerName}</Text>
                      <Text style={styles.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                    </View>
                    {isMine ? (
                      <Pressable onPress={() => deleteReview.mutate(review.id)}>
                        <Text style={styles.reviewDelete}>Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {review.title ? <Text style={styles.reviewItemTitle}>{review.title}</Text> : null}
                  {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.reviewMuted}>No reviews yet. Be the first.</Text>
        )}

        {isAuthenticated ? (
          <View style={styles.reviewForm}>
            <Text style={styles.reviewFormTitle}>Write a review</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setReviewRating(n)} style={styles.ratingBtn}>
                  <Text style={n <= reviewRating ? styles.ratingOn : styles.ratingOff}>★</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={reviewTitle}
              onChangeText={setReviewTitle}
              placeholder="Title (optional)"
              style={styles.input}
              placeholderTextColor={Brand.muted}
            />
            <TextInput
              value={reviewBody}
              onChangeText={setReviewBody}
              placeholder="Share your experience (optional)"
              style={[styles.input, styles.textArea]}
              multiline
              placeholderTextColor={Brand.muted}
            />
            <Pressable
              onPress={() => submitReview.mutate()}
              style={({ pressed }: { pressed: boolean }) => [styles.submitBtn, (pressed || submitReview.isPending) && { opacity: 0.85 }]}
            >
              <Text style={styles.submitBtnText}>{submitReview.isPending ? 'Submitting...' : 'Submit review'}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.reviewMuted}>Sign in to leave a review.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  body: { paddingBottom: 40 },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: Brand.pageBg,
  },
  muted: { marginTop: 10, color: Brand.muted, fontSize: 15 },
  error: { color: Brand.red, fontWeight: '700', fontSize: 15 },

  carouselWrap: { position: 'relative' },
  carouselImg: { width: SCREEN_W, height: SCREEN_W * 0.85, backgroundColor: Brand.border },
  heroPh: { alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: Brand.border },
  heroLetter: { fontSize: 64, fontWeight: '900', color: Brand.blue },
  dotRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingVertical: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.border },
  dotActive: { backgroundColor: Brand.blue, width: 18 },
  pricePill: {
    position: 'absolute', left: 16, bottom: 50,
    backgroundColor: Brand.navy, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  pricePillText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  heartBtn: {
    position: 'absolute', top: 14, right: 16,
    backgroundColor: Brand.card, padding: 10, borderRadius: 999,
    borderWidth: 1, borderColor: Brand.border,
  },

  panel: {
    marginHorizontal: 16, marginTop: 10,
    backgroundColor: Brand.card, borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: Brand.border,
  },
  title: { fontSize: 24, fontWeight: '900', color: Brand.navy, lineHeight: 30, letterSpacing: -0.3 },
  priceLine: { fontSize: 20, fontWeight: '800', color: Brand.blue, marginTop: 10 },
  desc: { fontSize: 15, color: '#334155', marginTop: 16, lineHeight: 23 },

  variantSection: { marginTop: 16 },
  variantLabel: {
    fontSize: 11, fontWeight: '800', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },
  variantChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.pageBg,
    flexDirection: 'row', alignItems: 'center',
  },
  variantChipActive: { borderColor: Brand.blue, backgroundColor: '#f0f7ff' },
  variantChipOut: { opacity: 0.5 },
  variantChipText: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  variantChipTextActive: { color: Brand.blue },
  variantChipOutText: { fontSize: 11, color: Brand.muted },
  stockNote: { marginTop: 8, fontSize: 12, color: Brand.muted, fontWeight: '600' },

  walletCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f0f7ff', borderRadius: 12, padding: 12, marginTop: 16,
    borderWidth: 1, borderColor: Brand.blue + '44',
  },
  walletLabel: { fontSize: 10, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  walletAmount: { fontSize: 15, fontWeight: '900', color: Brand.navy, marginTop: 2 },
  topUpBtn: {
    backgroundColor: Brand.blue, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  topUpText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  wantBtn: {
    marginTop: 18, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, backgroundColor: Brand.blue,
    paddingVertical: 14, borderRadius: 12,
  },
  wantBtnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  wantBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  wantHint: { marginTop: 8, fontSize: 11, color: Brand.muted, textAlign: 'center' },

  gateCard: {
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: '#fff7ed', borderRadius: 18, padding: 20,
    borderWidth: 2, borderColor: Brand.orange,
    alignItems: 'center', gap: 8,
  },
  gateIcon: { fontSize: 32 },
  gateTitle: { fontSize: 15, fontWeight: '900', color: Brand.navy, textAlign: 'center' },
  gateBody: { fontSize: 12, color: Brand.muted, textAlign: 'center', lineHeight: 17 },
  gateBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Brand.orange, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
  },
  gateBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  storePanel: {
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: Brand.card, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Brand.border,
  },
  storeLabel: {
    fontSize: 11, fontWeight: '800', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeLogoBox: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: Brand.pageBg,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: Brand.border,
  },
  storeLogoImg: { width: '100%', height: '100%' },
  storeText: { flex: 1, gap: 3 },
  storeName: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  mallRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mallText: { fontSize: 12, color: Brand.muted, fontWeight: '500' },
  visitBtn: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, backgroundColor: Brand.navy,
    paddingVertical: 14, borderRadius: 12,
  },
  visitBtnPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  visitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
  lockedBox: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Brand.pageBg, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Brand.border,
  },
  lockedText: { flex: 1, fontSize: 12, color: Brand.muted, fontWeight: '600' },

  reviewPanel: {
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: Brand.card, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Brand.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  reviewTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  reviewAvg: { fontSize: 12, color: Brand.muted, fontWeight: '700' },
  reviewMuted: { fontSize: 12, color: Brand.muted },
  reviewList: { gap: 10 },
  reviewCard: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 12,
    padding: 10, backgroundColor: Brand.pageBg, gap: 4,
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  reviewName: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  reviewStars: { fontSize: 12, color: '#f59e0b' },
  reviewDelete: { fontSize: 12, color: Brand.red, fontWeight: '700' },
  reviewItemTitle: { fontSize: 13, fontWeight: '700', color: '#334155' },
  reviewBody: { fontSize: 12, color: '#475569', lineHeight: 18 },
  reviewForm: { marginTop: 12, gap: 8 },
  reviewFormTitle: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  ratingRow: { flexDirection: 'row', gap: 4 },
  ratingBtn: { paddingVertical: 2, paddingHorizontal: 3 },
  ratingOn: { color: '#f59e0b', fontSize: 22 },
  ratingOff: { color: '#cbd5e1', fontSize: 22 },
  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, color: Brand.navy,
    backgroundColor: '#fff', fontSize: 13,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  submitBtn: {
    marginTop: 2, backgroundColor: Brand.blue, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 11,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
