import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Brand } from '@/constants/brand';
import { fetchOpenDemandsPage, type OpenDemandRow } from '@/lib/demands-api';
import { formatMoney } from '@/lib/products';

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      }
    : { elevation: 3 };

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return iso;
  }
}

const FIVE_MIN_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function DemandExpiryChip({ expiresAt }: { expiresAt?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  const msLeft = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  if (msLeft > ONE_HOUR_MS) return null;
  const isCritical = msLeft <= FIVE_MIN_MS;
  const mins = Math.floor(msLeft / 60000);
  const secs = Math.floor((msLeft % 60000) / 1000);
  const label = msLeft <= 0 ? 'Expired' : isCritical ? `${mins}m ${secs}s left` : `${Math.ceil(msLeft / 60000)}m left`;
  const pct = Math.min(100, (msLeft / ONE_HOUR_MS) * 100);
  return (
    <View style={styles.expiryWrap}>
      <Text style={[styles.expiryLabel, isCritical && { color: Brand.red }]}>{label}</Text>
      <View style={styles.expiryTrack}>
        <View style={[styles.expiryFill, { width: `${pct}%`, backgroundColor: isCritical ? Brand.red : Brand.blue }]} />
      </View>
    </View>
  );
}

export default function OpenDemandsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['open-demands'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchOpenDemandsPage(pageParam as number, 20),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  }, [query]);

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.heroBar}>
          <Text style={styles.heroTitle}>Open demands</Text>
          <Text style={styles.heroTag}>Public marketplace — tap a row to send an offer (stall account).</Text>
        </View>
      </View>
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: OpenDemandRow }) => {
      const cur = item.currency || 'USD';
      return (
        <Pressable
          style={[styles.card, cardShadow]}
          onPress={() => router.push({ pathname: '/demand/offer/[demandId]', params: { demandId: item.id } })}
        >
          <View style={styles.rowTop}>
            <Text style={styles.urgency}>{item.urgency}</Text>
            <Text style={styles.date}>{formatWhen(item.createdAt)}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.budget}>
            Budget up to {formatMoney(item.maxBudget, cur)}
            {item.minBudget != null ? ` (from ${formatMoney(item.minBudget, cur)})` : ''}
          </Text>
          <DemandExpiryChip expiresAt={item.expiresAt} />
        </Pressable>
      );
    },
    [router],
  );

  if (query.isPending && !query.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading open demands…</Text>
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Could not load open demands.</Text>
        <Pressable style={styles.retry} onPress={() => query.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item: { id: string }) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        query.isFetchingNextPage ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color={Brand.blue} />
        ) : null
      }
      ListEmptyComponent={<Text style={styles.empty}>No open demands right now.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  headerBlock: { paddingTop: 8, marginBottom: 12 },
  heroBar: {
    backgroundColor: Brand.navy,
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroTag: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  urgency: { fontSize: 11, fontWeight: '800', color: Brand.blue, textTransform: 'uppercase' },
  date: { fontSize: 12, color: Brand.muted },
  title: { fontSize: 17, fontWeight: '800', color: Brand.navy, marginBottom: 6 },
  budget: { fontSize: 14, fontWeight: '600', color: Brand.text },
  expiryWrap: { marginTop: 8 },
  expiryLabel: { fontSize: 11, fontWeight: '800', color: Brand.blue, marginBottom: 4 },
  expiryTrack: { height: 5, borderRadius: 999, backgroundColor: Brand.border, overflow: 'hidden' },
  expiryFill: { height: '100%', borderRadius: 999 },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700', textAlign: 'center' },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
});
