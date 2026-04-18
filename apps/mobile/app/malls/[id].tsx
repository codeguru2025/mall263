import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { fetchMallProducts, fetchMalls, type StallProductBrowseItem } from '@/lib/stalls-api';
import { formatMoney } from '@/lib/products';
import { Brand } from '@/constants/brand';

const { width } = Dimensions.get('window');
const GRID_GAP = 10;
const COLS = 2;
const CARD_WIDTH = (width - 14 * 2 - GRID_GAP) / COLS;

export default function MallDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);

  const mallQ = useQuery({
    queryKey: ['malls'],
    queryFn: () => fetchMalls(),
    staleTime: 5 * 60 * 1000,
  });
  const mall = (mallQ.data ?? []).find((m) => m.id === id);

  const productsQ = useInfiniteQuery({
    queryKey: ['mall-products', id],
    queryFn: ({ pageParam = 1 }) => fetchMallProducts(id!, pageParam, 24),
    initialPageParam: 1,
    enabled: !!id,
    getNextPageParam: (last) => {
      if (!last?.page || !last?.totalPages) return undefined;
      return last.page < last.totalPages ? last.page + 1 : undefined;
    },
  });

  const products = (productsQ.data?.pages ?? []).flatMap((p) => p?.data ?? []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await productsQ.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [productsQ]);

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing mall id.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(p: { id: string }) => p.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: 14 }}
        contentContainerStyle={{ paddingVertical: 14, paddingBottom: 40, gap: GRID_GAP }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={() => {
          if (productsQ.hasNextPage && !productsQ.isFetchingNextPage) productsQ.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heroImage}>
              {mall?.imageUrl ? (
                <Image source={{ uri: mall.imageUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
              ) : null}
              <View style={styles.heroOverlay} />
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>{mall?.name ?? 'Mall'}</Text>
                {mall?.city ? (
                  <View style={styles.heroMetaRow}>
                    <FontAwesome name="map-marker" size={12} color="#ffffffcc" />
                    <Text style={styles.heroMeta}>
                      {[mall.city, mall.address].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}
                {mall?._count?.stalls != null ? (
                  <View style={styles.pill}>
                    <FontAwesome name="shopping-bag" size={10} color={Brand.navy} />
                    <Text style={styles.pillText}>{mall._count.stalls} stalls</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Text style={styles.sectionTitle}>Products</Text>
          </View>
        }
        renderItem={({ item }: { item: StallProductBrowseItem }) => <ProductCard p={item} />}
        ListEmptyComponent={
          productsQ.isPending ? (
            <ActivityIndicator color={Brand.blue} style={{ marginTop: 30 }} />
          ) : (
            <View style={styles.emptyBox}>
              <FontAwesome name="search" size={26} color={Brand.muted} />
              <Text style={styles.emptyText}>No products listed in this mall yet.</Text>
            </View>
          )
        }
        ListFooterComponent={
          productsQ.isFetchingNextPage ? (
            <ActivityIndicator color={Brand.blue} style={{ marginVertical: 16 }} />
          ) : null
        }
      />
    </View>
  );
}

function ProductCard({ p }: { p: StallProductBrowseItem }) {
  const img = p.images?.[0]?.url;
  const currency = p.currency ?? 'USD';
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } })}
    >
      <View style={styles.cardImg}>
        {img ? (
          <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.cardImgPh}>
            <Text style={styles.cardImgLetter}>{p.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
        <Text style={styles.cardPrice}>
          {formatMoney(p.minPrice, currency)}
          {String(p.minPrice) !== String(p.maxPrice)
            ? ` – ${formatMoney(p.maxPrice, currency)}`
            : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: Brand.pageBg,
  },
  error: { color: Brand.red, fontWeight: '700' },

  header: { paddingHorizontal: 14, paddingBottom: 10 },
  heroImage: {
    height: 150,
    borderRadius: 18,
    backgroundColor: Brand.navy,
    justifyContent: 'flex-end',
    padding: 16,
    overflow: 'hidden',
  },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000066' },
  heroText: { gap: 6 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMeta: { color: '#ffffffcc', fontSize: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#ffffffeb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  pillText: { color: Brand.navy, fontSize: 11, fontWeight: '800' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Brand.navy,
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 2,
  },

  card: {
    width: CARD_WIDTH,
    backgroundColor: Brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
  },
  cardImg: { aspectRatio: 1, backgroundColor: Brand.pageBg },
  cardImgPh: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  cardImgLetter: { fontSize: 36, fontWeight: '900', color: Brand.blue },
  cardBody: { padding: 10, gap: 4 },
  cardName: { fontSize: 12, fontWeight: '700', color: Brand.navy, minHeight: 32, lineHeight: 16 },
  cardPrice: { fontSize: 13, fontWeight: '900', color: Brand.blue },

  emptyBox: {
    alignItems: 'center',
    padding: 30,
    gap: 8,
  },
  emptyText: { fontSize: 13, color: Brand.muted, textAlign: 'center' },
});
