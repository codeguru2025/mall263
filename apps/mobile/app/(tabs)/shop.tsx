import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getStaffHomePath, isStaffAdminRole } from '@mall263/shared';
import { Brand } from '@/constants/brand';
import { fetchShopFeedPage, fetchActiveAd, formatMoney, type ShopListItem } from '@/lib/shop-feed';
import { fetchCategories } from '@/lib/seller-api';
import { displayCity, fetchMalls } from '@/lib/stalls-api';

function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10 }
    : { elevation: 3 };

export default function ShopScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const staffHome = isAuthenticated && isStaffAdminRole(user?.role) ? getStaffHomePath(user?.role) : null;
  const blockStaff = !!staffHome;

  const [draftQuery, setDraftQuery] = useState('');
  const debouncedQuery = useDebouncedValue(draftQuery, 400);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedMallId, setSelectedMallId] = useState<string | null>(null);
  const [showMallFilter, setShowMallFilter] = useState(false);
  const [nearLat, setNearLat] = useState<number | null>(null);
  const [nearLng, setNearLng] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [geoLoading, setGeoLoading] = useState(false);

  const handleNearMe = useCallback(async () => {
    if (nearLat !== null) {
      setNearLat(null);
      setNearLng(null);
      return;
    }
    setGeoLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Enable location access in Settings to filter by proximity.');
      setGeoLoading(false);
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setNearLat(loc.coords.latitude);
      setNearLng(loc.coords.longitude);
      setSelectedMallId(null);
    } catch {
      Alert.alert('Location error', 'Could not get your current location.');
    } finally {
      setGeoLoading(false);
    }
  }, [nearLat]);

  const categoriesQ = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
    enabled: !blockStaff,
  });
  const mallsQ = useQuery({ queryKey: ['malls'], queryFn: () => fetchMalls(), staleTime: 5 * 60_000, enabled: !blockStaff });
  const adQ = useQuery({
    queryKey: ['shop-ad'],
    queryFn: () => fetchActiveAd('BANNER_TOP'),
    staleTime: 60_000,
    retry: false,
    enabled: !blockStaff,
  });

  const feedKey = useMemo(
    () => `${debouncedQuery.trim()}|${selectedCategoryId ?? ''}|${selectedMallId ?? ''}|${nearLat ?? ''}|${nearLng ?? ''}|${radiusKm}`,
    [debouncedQuery, selectedCategoryId, selectedMallId, nearLat, nearLng, radiusKm],
  );

  const query = useInfiniteQuery({
    queryKey: ['shop-feed', feedKey],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchShopFeedPage(debouncedQuery.trim(), pageParam as number, 20, {
        categoryId: selectedCategoryId ?? undefined,
        mallId: nearLat ? undefined : (selectedMallId ?? undefined),
        nearLat: nearLat ?? undefined,
        nearLng: nearLng ?? undefined,
        radiusKm: nearLat ? radiusKm : undefined,
      }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !blockStaff,
  });

  const items = query.data?.pages.flatMap((p) => p.rows) ?? [];
  const totalLoaded = query.data?.pages[0]?.total;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: ShopListItem }) => {
      const img = item.imageUrl;
      const hasRange = String(item.minPrice) !== String(item.maxPrice);
      return (
        <Pressable
          style={({ pressed }: { pressed: boolean }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
          android_ripple={{ color: Brand.border, borderless: false }}
        >
          <View style={styles.thumbWrap}>
            {img ? (
              <Image
                source={{ uri: img }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
                recyclingKey={item.id}
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbLetter}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.price} numberOfLines={1}>
              {formatMoney(item.minPrice, item.currency || 'USD')}
              {hasRange ? `+` : ''}
            </Text>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            {item.subtitle ? (
              <Text style={styles.meta} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [router],
  );

  const categories = categoriesQ.data ?? [];
  const malls = mallsQ.data ?? [];
  const selectedMall = malls.find((m) => m.id === selectedMallId);
  const ad = adQ.data;

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.heroBar}>
        <Text style={styles.heroTitle}>Shop</Text>
        <Text style={styles.heroTag}>Same catalogue as the website</Text>
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products…"
          placeholderTextColor={Brand.muted}
          value={draftQuery}
          onChangeText={setDraftQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {draftQuery.length > 0 ? (
          <Pressable onPress={() => setDraftQuery('')} hitSlop={12} style={styles.clearBtn}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Category filter strip */}
      {categories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>
          <Pressable
            style={[styles.catChip, !selectedCategoryId && styles.catChipActive]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text style={[styles.catChipText, !selectedCategoryId && styles.catChipTextActive]}>All</Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.catChip, selectedCategoryId === cat.id && styles.catChipActive]}
              onPress={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
            >
              <Text style={[styles.catChipText, selectedCategoryId === cat.id && styles.catChipTextActive]}>
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Mall filter pill + Near me */}
      <View style={styles.mallFilterRow}>
        {/* Near me button */}
        <Pressable
          style={[styles.nearMePill, nearLat !== null && styles.nearMePillActive]}
          onPress={handleNearMe}
          disabled={geoLoading}
        >
          {geoLoading
            ? <ActivityIndicator size={12} color={nearLat !== null ? '#fff' : Brand.orange} />
            : <Text style={styles.nearMeIcon}>📍</Text>
          }
          <Text style={[styles.nearMePillText, nearLat !== null && styles.nearMePillTextActive]}>
            {nearLat !== null ? `Near me (${radiusKm}km) ×` : 'Near me'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.mallPill, !nearLat && selectedMallId && styles.mallPillActive]}
          onPress={() => !nearLat && setShowMallFilter(!showMallFilter)}
          disabled={nearLat !== null}
        >
          <Text style={[styles.mallPillText, !nearLat && selectedMallId && styles.mallPillTextActive]}>
            {!nearLat && selectedMall ? `🏬 ${selectedMall.name}` : '🏬 All malls'}
          </Text>
          <Text style={[styles.mallPillCaret, !nearLat && selectedMallId && styles.mallPillTextActive]}>▾</Text>
        </Pressable>
        {selectedMallId && (
          <Pressable style={styles.clearMall} onPress={() => setSelectedMallId(null)}>
            <Text style={styles.clearMallText}>× Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Mall dropdown */}
      {showMallFilter && malls.length > 0 && (
        <View style={styles.mallDropdown}>
          <Pressable
            style={[styles.mallOption, !selectedMallId && styles.mallOptionActive]}
            onPress={() => { setSelectedMallId(null); setShowMallFilter(false); }}
          >
            <Text style={[styles.mallOptionText, !selectedMallId && styles.mallOptionTextActive]}>All malls</Text>
          </Pressable>
          {malls.map((m) => {
            const city = displayCity(m.city);
            return (
            <Pressable
              key={m.id}
              style={[styles.mallOption, selectedMallId === m.id && styles.mallOptionActive]}
              onPress={() => { setSelectedMallId(m.id); setShowMallFilter(false); }}
            >
              <Text style={[styles.mallOptionText, selectedMallId === m.id && styles.mallOptionTextActive]}>
                {m.name}{city ? ` · ${city}` : ''}
              </Text>
            </Pressable>
            );
          })}
        </View>
      )}

      {/* Ad banner */}
      {ad?.imageUrl && (
        <Pressable
          style={styles.adBanner}
          onPress={() => ad.linkUrl && Linking.openURL(ad.linkUrl)}
          activeOpacity={ad.linkUrl ? 0.85 : 1}
        >
          <Image
            source={{ uri: ad.imageUrl }}
            style={styles.adBannerImg}
            contentFit="cover"
            transition={200}
          />
          {ad.title ? (
            <View style={styles.adLabel}>
              <Text style={styles.adLabelText}>AD</Text>
              <Text style={styles.adTitle} numberOfLines={1}>{ad.title}</Text>
            </View>
          ) : null}
        </Pressable>
      )}

      {typeof totalLoaded === 'number' && !debouncedQuery.trim() ? (
        <Text style={styles.countLine}>{totalLoaded} listing{totalLoaded === 1 ? '' : 's'}</Text>
      ) : null}
    </View>
  );

  if (staffHome) {
    return <Redirect href={staffHome as never} />;
  }

  if (query.isPending) {
    return (
      <View style={styles.page}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Brand.blue} />
          <Text style={styles.muted}>Loading products…</Text>
        </View>
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.page}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load</Text>
          <Text style={styles.muted}>Pull to retry or check your connection.</Text>
          <Pressable style={styles.retry} onPress={() => query.refetch()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        key="shop-grid-3col"
        data={items}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={renderItem}
        numColumns={3}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} colors={[Brand.blue]} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footerSpinner} color={Brand.blue} />
          ) : (
            <View style={styles.footerSpacer} />
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{debouncedQuery.trim() ? 'No matches' : 'No products yet'}</Text>
            <Text style={styles.muted}>
              {debouncedQuery.trim() ? 'Try different keywords or clear search to browse everything.' : 'Check back soon.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  headerBlock: { paddingBottom: 8 },
  heroBar: {
    backgroundColor: Brand.blue,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  heroTag: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3, fontWeight: '500' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: -16,
    backgroundColor: Brand.card,
    borderRadius: 14,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Brand.border,
    ...cardShadow,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: Brand.text,
  },
  clearBtn: { paddingRight: 12, paddingVertical: 8 },
  clear: { fontSize: 15, fontWeight: '700', color: Brand.blue },

  categoryStrip: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1.5, borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  catChipActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  catChipText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
  catChipTextActive: { color: '#fff' },

  mallFilterRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    paddingTop: 8, paddingBottom: 4, gap: 8,
  },
  nearMePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1.5, borderColor: Brand.orange,
    backgroundColor: '#fff7f0',
  },
  nearMePillActive: { backgroundColor: Brand.orange, borderColor: Brand.orange },
  nearMeIcon: { fontSize: 12 },
  nearMePillText: { fontSize: 12, fontWeight: '700', color: Brand.orange },
  nearMePillTextActive: { color: '#fff' },
  mallPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  mallPillActive: { borderColor: Brand.navy, backgroundColor: '#e6e9f1' },
  mallPillText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
  mallPillTextActive: { color: Brand.navy },
  mallPillCaret: { fontSize: 11, color: Brand.muted },
  clearMall: { paddingHorizontal: 10, paddingVertical: 7 },
  clearMallText: { fontSize: 12, fontWeight: '700', color: Brand.red },

  mallDropdown: {
    marginHorizontal: 14, marginTop: 2,
    backgroundColor: Brand.card, borderRadius: 12,
    borderWidth: 1, borderColor: Brand.border,
    overflow: 'hidden', ...cardShadow,
  },
  mallOption: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  mallOptionActive: { backgroundColor: '#f0f7ff' },
  mallOptionText: { fontSize: 13, color: Brand.text, fontWeight: '600' },
  mallOptionTextActive: { color: Brand.blue, fontWeight: '700' },

  adBanner: {
    marginHorizontal: 14, marginTop: 10, borderRadius: 12, overflow: 'hidden',
    height: 100, backgroundColor: Brand.border,
  },
  adBannerImg: { width: '100%', height: '100%' },
  adLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5,
  },
  adLabelText: {
    fontSize: 9, fontWeight: '900', color: '#fff',
    backgroundColor: Brand.orange, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  adTitle: { flex: 1, fontSize: 12, color: '#fff', fontWeight: '600' },

  countLine: {
    marginHorizontal: 20, marginTop: 10,
    fontSize: 12, fontWeight: '600', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  listContent: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 24 },
  columnWrapper: { gap: 5, marginBottom: 5 },
  card: {
    flex: 1, backgroundColor: Brand.card, borderRadius: 8,
    borderWidth: 1, borderColor: Brand.border, overflow: 'hidden',
  },
  cardPressed: { opacity: 0.88 },
  thumbWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#f1f5f9' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8edf5' },
  thumbLetter: { fontSize: 28, fontWeight: '900', color: Brand.blue },
  cardBody: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 8, gap: 2 },
  price: { fontSize: 13, fontWeight: '900', color: Brand.orange, letterSpacing: -0.2 },
  name: { fontSize: 11, fontWeight: '600', color: Brand.navy, lineHeight: 15 },
  meta: { fontSize: 10, color: Brand.muted, fontWeight: '500' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { marginTop: 10, color: Brand.muted, textAlign: 'center', fontSize: 15 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: Brand.red },
  retry: {
    marginTop: 18, backgroundColor: Brand.blue,
    paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyBox: { paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Brand.navy, marginBottom: 8 },
  footerSpinner: { marginVertical: 20 },
  footerSpacer: { height: 16 },
});
