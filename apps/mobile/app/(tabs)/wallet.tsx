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
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { isWalletTxCredit, walletTxTypeLabel } from '@mall263/shared';
import { Brand } from '@/constants/brand';
import { fetchWalletBalance, fetchWalletTransactionsPage, type WalletTxRow } from '@/lib/wallet-api';
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

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function WalletScreen() {
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const balanceQ = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: fetchWalletBalance,
  });

  const txQ = useInfiniteQuery({
    queryKey: ['wallet-transactions'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchWalletTransactionsPage(pageParam as number, 25),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const rows = txQ.data?.pages.flatMap((p) => p.data) ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([balanceQ.refetch(), txQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [balanceQ, txQ]);

  const loadMore = useCallback(() => {
    if (txQ.hasNextPage && !txQ.isFetchingNextPage) txQ.fetchNextPage();
  }, [txQ]);

  const currency = balanceQ.data?.currency ?? 'USD';

  const header = useMemo(() => {
    if (balanceQ.isPending) {
      return (
        <View style={styles.headerBlock}>
          <ActivityIndicator color={Brand.blue} />
        </View>
      );
    }
    if (balanceQ.isError) {
      return (
        <View style={[styles.heroBar, styles.heroError]}>
          <Text style={styles.heroTitle}>Wallet</Text>
          <Text style={styles.heroTag}>Could not load balance. Pull to refresh or open the website.</Text>
        </View>
      );
    }
    const b = balanceQ.data!;
    return (
      <View style={styles.headerBlock}>
        <View style={styles.heroBar}>
          <Text style={styles.heroTitle}>Wallet</Text>
          <Text style={styles.heroTag}>Read-only on mobile — same data as the website.</Text>
        </View>
        <View style={[styles.balanceCard, cardShadow]}>
          <Text style={styles.balanceLabel}>Available</Text>
          <Text style={styles.balanceBig}>{formatMoney(b.available, currency)}</Text>
          {Number(b.locked) > 0 && (
            <>
              <Text style={styles.balanceLabelMuted}>Locked</Text>
              <Text style={styles.balanceLocked}>{formatMoney(b.locked, currency)}</Text>
            </>
          )}
          <View style={styles.btnRow}>
            <Pressable style={styles.depositBtn} onPress={() => router.push('/deposit')}>
              <Text style={styles.depositBtnText}>+ Deposit</Text>
            </Pressable>
            <Pressable style={styles.withdrawBtn} onPress={() => router.push('/withdraw')}>
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Transactions</Text>
      </View>
    );
  }, [balanceQ.isPending, balanceQ.isError, balanceQ.data, currency]);

  const renderItem = useCallback(
    ({ item }: { item: WalletTxRow }) => {
      const credit = isWalletTxCredit(item.type);
      const sign = credit ? '+' : '−';
      const label = walletTxTypeLabel(item.type);
      return (
        <View style={[styles.txRow, cardShadow]}>
          <View style={styles.txMain}>
            <Text style={styles.txTitle} numberOfLines={2}>
              {item.description?.trim() || label}
            </Text>
            <Text style={styles.txMeta}>
              {label} · {fmtWhen(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.txAmt, credit ? styles.txCredit : styles.txDebit]}>
            {sign}
            {formatMoney(item.amount, currency)}
          </Text>
        </View>
      );
    },
    [currency],
  );

  if (txQ.isPending && !txQ.data && balanceQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading wallet…</Text>
      </View>
    );
  }

  if (txQ.isError && !txQ.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Could not load transactions.</Text>
        <Pressable style={styles.retry} onPress={() => txQ.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item: { id: string }) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.35}
      ListFooterComponent={
        txQ.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={Brand.blue} /> : null
      }
      ListEmptyComponent={
        balanceQ.isError ? null : <Text style={styles.empty}>No transactions yet.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  headerBlock: { paddingTop: 8, marginBottom: 8 },
  heroBar: {
    backgroundColor: Brand.navy,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  heroError: { backgroundColor: '#7f1d1d' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroTag: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, fontWeight: '600' },
  balanceCard: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  balanceLabel: { fontSize: 11, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  balanceBig: { fontSize: 28, fontWeight: '900', color: Brand.navy, marginTop: 4 },
  balanceLabelMuted: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 12 },
  balanceLocked: { fontSize: 18, fontWeight: '800', color: Brand.navy, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  depositBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Brand.blue,
  },
  depositBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  withdrawBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Brand.blue,
  },
  withdrawBtnText: { color: Brand.blue, fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginBottom: 10 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 12,
  },
  txMain: { flex: 1, minWidth: 0 },
  txTitle: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  txMeta: { fontSize: 11, color: Brand.muted, marginTop: 4 },
  txAmt: { fontSize: 14, fontWeight: '900' },
  txCredit: { color: '#15803d' },
  txDebit: { color: Brand.red },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 12, marginBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700', textAlign: 'center' },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
});
