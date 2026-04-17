import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Brand } from '@/constants/brand';
import { fetchShopFeedPage, formatMoney, type ShopListItem } from '@/lib/shop-feed';

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
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      }
    : { elevation: 3 };

export default function ShopScreen() {
  const router = useRouter();
  const [draftQuery, setDraftQuery] = useState('');
  const debouncedQuery = useDebouncedValue(draftQuery, 400);
  const [refreshing, setRefreshing] = useState(false);

  const feedKey = useMemo(() => debouncedQuery.trim(), [debouncedQuery]);

  const query = useInfiniteQuery({
    queryKey: ['shop-feed', feedKey],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchShopFeedPage(feedKey, pageParam as number, 20),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
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
      return (
        <Pressable
          style={[styles.card, cardShadow]}
          onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
        >
          <View style={styles.thumbWrap}>
            {img ? (
              <Image source={{ uri: img }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbLetter}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            {item.subtitle ? (
              <Text style={styles.meta} numberOfLines={1}>
                {item.subtitle}
              </Text>
            ) : null}
            <Text style={styles.price}>
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
      {typeof totalLoaded === 'number' && !feedKey ? (
        <Text style={styles.countLine}>{totalLoaded} listing{totalLoaded === 1 ? '' : 's'}</Text>
      ) : null}
    </View>
  );

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
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
            <Text style={styles.emptyTitle}>{feedKey ? 'No matches' : 'No products yet'}</Text>
            <Text style={styles.muted}>
              {feedKey ? 'Try different keywords or clear search to browse everything.' : 'Check back soon.'}
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
    backgroundColor: Brand.navy,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  heroTag: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: -12,
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
  countLine: {
    marginHorizontal: 20,
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  listContent: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 10,
    backgroundColor: Brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  thumbWrap: { marginRight: 12 },
  thumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: Brand.pageBg, overflow: 'hidden' },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  thumbLetter: { fontSize: 28, fontWeight: '800', color: Brand.blue },
  rowBody: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Brand.navy, lineHeight: 21 },
  meta: { fontSize: 13, color: Brand.muted, marginTop: 4 },
  price: { fontSize: 15, fontWeight: '700', color: Brand.blue, marginTop: 8 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { marginTop: 10, color: Brand.muted, textAlign: 'center', fontSize: 15 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: Brand.red },
  retry: {
    marginTop: 18,
    backgroundColor: Brand.blue,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyBox: { paddingVertical: 48, paddingHorizontal: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Brand.navy, marginBottom: 8 },
  footerSpinner: { marginVertical: 20 },
  footerSpacer: { height: 16 },
});
