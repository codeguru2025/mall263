import { useCallback, useMemo, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Brand } from '@/constants/brand';
import { fetchMyDemands, type DemandListItem } from '@/lib/demands-api';
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

type FilterKey = 'all' | 'open';

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return iso;
  }
}

export default function DemandsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const statusParam = filter === 'open' ? 'OPEN' : undefined;

  const q = useQuery({
    queryKey: ['my-demands', statusParam ?? 'all'],
    queryFn: () => fetchMyDemands(statusParam),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [q]);

  const header = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <View style={styles.heroBar}>
          <Text style={styles.heroTitle}>My demands</Text>
          <Text style={styles.heroTag}>Post what you need — sellers send offers.</Text>
        </View>
        <View style={styles.ctaRow}>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/demand/new')}>
            <Text style={styles.primaryBtnText}>Post a demand</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/demand/open')}>
            <Text style={styles.secondaryBtnText}>Browse open</Text>
          </Pressable>
        </View>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, filter === 'all' && styles.filterChipOn]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextOn]}>All</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filter === 'open' && styles.filterChipOn]}
            onPress={() => setFilter('open')}
          >
            <Text style={[styles.filterChipText, filter === 'open' && styles.filterChipTextOn]}>Open</Text>
          </Pressable>
        </View>
      </View>
    ),
    [filter, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: DemandListItem }) => {
      const pending = (item.offers ?? []).filter((o) => o.status === 'PENDING').length;
      return (
        <Pressable
          style={[styles.card, cardShadow]}
          onPress={() => router.push({ pathname: '/demand/[id]', params: { id: item.id } })}
        >
          <View style={styles.rowTop}>
            <Text style={styles.statusPill}>{item.status.replace(/_/g, ' ')}</Text>
            <Text style={styles.date}>{formatWhen(item.createdAt)}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.budget}>
            Budget up to {formatMoney(item.maxBudget, item.currency || 'USD')}
          </Text>
          <Text style={styles.meta}>
            {pending > 0 ? `${pending} pending offer${pending === 1 ? '' : 's'}` : 'No pending offers'}
          </Text>
        </Pressable>
      );
    },
    [router],
  );

  if (q.isPending && !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading demands…</Text>
      </View>
    );
  }

  if (q.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Could not load demands.</Text>
        <Pressable style={styles.retry} onPress={() => q.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const rows = q.data ?? [];

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      ListEmptyComponent={<Text style={styles.empty}>No demands yet. Tap “Post a demand” to add one.</Text>}
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
    marginBottom: 14,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroTag: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  ctaRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  primaryBtn: {
    flex: 1,
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  secondaryBtnText: { color: Brand.navy, fontSize: 15, fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  filterChipOn: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  filterChipText: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  filterChipTextOn: { color: '#fff' },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusPill: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  date: { fontSize: 12, color: Brand.muted },
  title: { fontSize: 17, fontWeight: '800', color: Brand.navy, marginBottom: 6 },
  budget: { fontSize: 14, color: Brand.text, fontWeight: '600' },
  meta: { fontSize: 13, color: Brand.muted, marginTop: 6 },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 20, fontSize: 15, paddingHorizontal: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700', textAlign: 'center' },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
});
