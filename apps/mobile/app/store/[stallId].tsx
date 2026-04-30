import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import {
  displayCity,
  fetchStallById,
  fetchStallBrowsePage,
  followStall,
  recordStallVisit,
  unfollowStall,
  type StallProductBrowseItem,
} from '@/lib/stalls-api';
import { formatMoney } from '@/lib/products';
import { fetchMeProfile } from '@/lib/me-profile';
import { api } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/config';

async function fetchVirtualWalkExists(stallId: string): Promise<boolean> {
  try {
    const { data } = await api.get<unknown[]>(`/api/v1/virtual-walk/shop/${stallId}`);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      }
    : { elevation: 3 };

export default function StoreScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { stallId } = useLocalSearchParams<{ stallId: string }>();
  const resolved = Array.isArray(stallId) ? stallId[0] : stallId;
  const [refreshing, setRefreshing] = useState(false);
  const visitOnceRef = useRef(false);

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile, retry: false, staleTime: 60_000 });
  const isLoggedIn = !!meQ.data?.id;

  const stallQ = useQuery({
    queryKey: ['stall-detail', resolved],
    queryFn: () => fetchStallById(resolved!),
    enabled: !!resolved,
  });

  const virtualWalkQ = useQuery({
    queryKey: ['virtual-walk-exists', resolved],
    queryFn: () => fetchVirtualWalkExists(resolved!),
    enabled: !!resolved && !!stallQ.data,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!resolved || visitOnceRef.current) return;
    visitOnceRef.current = true;
    void recordStallVisit(resolved);
  }, [resolved]);

  const catalogQ = useInfiniteQuery({
    queryKey: ['store-catalog-infinite', resolved],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchStallBrowsePage(resolved!, pageParam as number, 24),
    getNextPageParam: (last) =>
      last && typeof last.page === 'number' && typeof last.totalPages === 'number'
        ? last.page < last.totalPages
          ? last.page + 1
          : undefined
        : undefined,
    enabled: !!resolved && !!stallQ.data,
  });

  const products = useMemo(
    () => catalogQ.data?.pages.flatMap((p) => p.data) ?? [],
    [catalogQ.data?.pages],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([stallQ.refetch(), catalogQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [stallQ, catalogQ]);

  const loadMore = () => {
    if (catalogQ.hasNextPage && !catalogQ.isFetchingNextPage) {
      catalogQ.fetchNextPage();
    }
  };

  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  const followMut = useMutation({
    mutationFn: async () => {
      const isFollowing = optimisticFollowing ?? stallQ.data?.isFollowing ?? false;
      if (isFollowing) return unfollowStall(resolved!);
      return followStall(resolved!);
    },
    onMutate: () => {
      const current = optimisticFollowing ?? stallQ.data?.isFollowing ?? false;
      const currentCount = optimisticCount ?? stallQ.data?.followerCount ?? 0;
      setOptimisticFollowing(!current);
      setOptimisticCount(current ? Math.max(0, currentCount - 1) : currentCount + 1);
    },
    onSuccess: (result) => {
      setOptimisticFollowing(result.following);
      setOptimisticCount(result.followerCount);
      qc.invalidateQueries({ queryKey: ['stall-detail', resolved] });
    },
    onError: () => {
      setOptimisticFollowing(null);
      setOptimisticCount(null);
    },
  });

  const stall = stallQ.data;
  const logo = stall?.logoUrl ?? stall?.merchant?.logoUrl ?? null;
  const storeName = stall?.name || stall?.merchant?.businessName || 'Store';
  const mallLine = stall?.mall
    ? [stall.mall.name, displayCity(stall.mall.city)].filter(Boolean).join(' · ')
    : '';

  const handleShare = useCallback(async () => {
    if (!resolved) return;
    const webUrl = `${getApiBaseUrl()}/stores/${resolved}`;
    try {
      await Share.share({
        title: storeName,
        message: Platform.OS === 'ios' ? storeName : `${storeName}\n${webUrl}`,
        url: webUrl,
      });
    } catch {
      // user cancelled — ignore
    }
  }, [resolved, storeName]);

  const header = (
    <View style={styles.headerBlock}>
      <View style={[styles.heroCard, cardShadow]}>
        <View style={styles.heroTop}>
          <View style={styles.logoBox}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logoImg} contentFit="cover" transition={180} />
            ) : (
              <Text style={styles.logoLetter}>
                {storeName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.heroText}>
            <Text style={styles.storeName} numberOfLines={2}>
              {storeName}
            </Text>
            {mallLine ? (
              <View style={styles.mallRow}>
                <FontAwesome name="map-marker" size={12} color={Brand.muted} />
                <Text style={styles.mallText} numberOfLines={1}>
                  {mallLine}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {stall?.description ? (
          <Text style={styles.desc} numberOfLines={3}>
            {stall.description}
          </Text>
        ) : null}

        <View style={styles.statsRow}>
          <Stat label="Products" value={stall?._count?.products ?? 0} />
          <View style={styles.statDivider} />
          <Stat label="Visits" value={stall?.viewCount ?? 0} />
          <View style={styles.statDivider} />
          <Stat
            label="Followers"
            value={optimisticCount ?? stall?.followerCount ?? 0}
          />
        </View>

        <View style={styles.storeActions}>
          {isLoggedIn && (
            <Pressable
              style={[
                styles.followBtn,
                (optimisticFollowing ?? stall?.isFollowing) && styles.followBtnActive,
                followMut.isPending && { opacity: 0.6 },
              ]}
              onPress={() => followMut.mutate()}
              disabled={followMut.isPending}
            >
              <FontAwesome
                name={(optimisticFollowing ?? stall?.isFollowing) ? 'heart' : 'heart-o'}
                size={14}
                color={(optimisticFollowing ?? stall?.isFollowing) ? '#fff' : Brand.blue}
              />
              <Text
                style={[
                  styles.followBtnText,
                  (optimisticFollowing ?? stall?.isFollowing) && styles.followBtnTextActive,
                ]}
              >
                {(optimisticFollowing ?? stall?.isFollowing) ? 'Following' : 'Follow store'}
              </Text>
            </Pressable>
          )}
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <FontAwesome name="share-alt" size={14} color={Brand.blue} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>

        {virtualWalkQ.data && resolved && (
          <Pressable
            style={styles.virtualWalkBtn}
            onPress={() => router.push({ pathname: '/virtual-walk/[stallId]', params: { stallId: resolved } } as never)}
          >
            <FontAwesome name="cube" size={14} color="#fff" />
            <Text style={styles.virtualWalkText}>Virtual Walk</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.catalogTitle}>Catalogue</Text>
    </View>
  );

  const renderItem = useCallback(
    ({ item }: { item: StallProductBrowseItem }) => {
      const img = item.images?.[0]?.url;
      return (
        <Pressable
          style={({ pressed }: { pressed: boolean }) => [styles.card, cardShadow, pressed && styles.cardPressed]}
          onPress={() =>
            router.push({ pathname: '/product/[id]', params: { id: item.id } })
          }
          android_ripple={{ color: Brand.border, borderless: false }}
        >
          <View style={styles.thumbWrap}>
            {img ? (
              <Image
                source={{ uri: img }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={180}
                recyclingKey={item.id}
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPh]}>
                <Text style={styles.thumbLetter}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cardPrice} numberOfLines={1}>
              {formatMoney(item.minPrice, item.currency || 'USD')}
              {String(item.minPrice) !== String(item.maxPrice)
                ? ` – ${formatMoney(item.maxPrice, item.currency || 'USD')}`
                : ''}
            </Text>
          </View>
        </Pressable>
      );
    },
    [router],
  );

  if (!resolved) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing store id.</Text>
      </View>
    );
  }

  if (stallQ.isPending) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Store' }} />
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading store…</Text>
      </View>
    );
  }

  if (stallQ.isError || !stall) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Store' }} />
        <Text style={styles.error}>Store not found or unavailable.</Text>
        <Pressable style={styles.retry} onPress={() => stallQ.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: storeName }} />
      <FlatList
        key="store-grid-2col"
        data={products}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Brand.blue}
            colors={[Brand.blue]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          catalogQ.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footerSpinner} color={Brand.blue} />
          ) : (
            <View style={styles.footerSpacer} />
          )
        }
        ListEmptyComponent={
          catalogQ.isPending ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator color={Brand.blue} />
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No products yet</Text>
              <Text style={styles.muted}>This store hasn’t listed anything.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Brand.pageBg,
  },
  muted: { marginTop: 10, color: Brand.muted, textAlign: 'center', fontSize: 15 },
  error: { color: Brand.red, fontWeight: '700', fontSize: 15 },
  retry: {
    marginTop: 18,
    backgroundColor: Brand.blue,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  headerBlock: { paddingTop: 12, paddingHorizontal: 14 },
  heroCard: {
    backgroundColor: Brand.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: 16,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Brand.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  logoImg: { width: '100%', height: '100%' },
  logoLetter: { fontSize: 28, fontWeight: '900', color: Brand.blue },
  heroText: { flex: 1, gap: 4 },
  storeName: { fontSize: 20, fontWeight: '900', color: Brand.navy, letterSpacing: -0.3 },
  mallRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mallText: { fontSize: 13, color: Brand.muted, fontWeight: '500' },
  desc: { marginTop: 12, fontSize: 14, lineHeight: 20, color: '#334155' },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 26, backgroundColor: Brand.border },
  statValue: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '700',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  storeActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.blue,
    backgroundColor: 'transparent',
  },
  followBtnActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  followBtnText: { fontSize: 14, fontWeight: '800', color: Brand.blue },
  followBtnTextActive: { color: '#fff' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12,
    borderWidth: 1.5, borderColor: Brand.blue, backgroundColor: 'transparent',
  },
  shareBtnText: { fontSize: 14, fontWeight: '800', color: Brand.blue },
  virtualWalkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 10, paddingVertical: 11, borderRadius: 12,
    backgroundColor: Brand.navy,
  },
  virtualWalkText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  catalogTitle: {
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  listContent: { paddingHorizontal: 10, paddingBottom: 24 },
  columnWrapper: { gap: 10, marginBottom: 10, paddingHorizontal: 4 },
  card: {
    flex: 1,
    flexBasis: '48%',
    maxWidth: '50%',
    backgroundColor: Brand.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  thumbWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#fff' },
  thumb: { width: '100%', height: '100%' },
  thumbPh: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  thumbLetter: { fontSize: 40, fontWeight: '800', color: Brand.blue },
  cardBody: { padding: 10, paddingTop: 8, gap: 4 },
  cardName: { fontSize: 13, fontWeight: '800', color: Brand.navy, lineHeight: 17 },
  cardPrice: { fontSize: 14, fontWeight: '800', color: Brand.blue, marginTop: 2 },

  emptyBox: { paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Brand.navy, marginBottom: 8 },
  footerSpinner: { marginVertical: 20 },
  footerSpacer: { height: 16 },
});
