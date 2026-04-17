import { useCallback, useState } from 'react';
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
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { fetchMeProfile } from '@/lib/me-profile';
import { fetchStallsByMerchant, type Stall } from '@/lib/seller-api';
import { fetchDailySummary, fetchSalesByStall, type POSSale } from '@/lib/pos-api';
import { formatMoney } from '@/lib/products';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function POSHomeScreen() {
  const [stallIndex, setStallIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });
  const profile = meQ.data;

  // Resolve stalls: merchant stalls + attendant stalls
  const merchantId = profile?.merchant?.id;
  const merchantStallsQ = useQuery({
    queryKey: ['my-stalls', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });

  // Build combined stall list (merchant stalls + attendant stalls)
  const merchantStalls: Stall[] = merchantStallsQ.data ?? [];
  const attendantStalls: Stall[] = (profile?.attendantStall ?? []).map((a) => a.stall);
  const allStalls = [...merchantStalls, ...attendantStalls].filter(
    (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
  );

  const stall = allStalls[stallIndex];

  const summaryQ = useQuery({
    queryKey: ['pos-summary', stall?.id],
    queryFn: () => fetchDailySummary(stall!.id),
    enabled: !!stall?.id,
  });

  const salesQ = useQuery({
    queryKey: ['pos-sales', stall?.id],
    queryFn: () => fetchSalesByStall(stall!.id, 1, 10),
    enabled: !!stall?.id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([meQ.refetch(), summaryQ.refetch(), salesQ.refetch()]); }
    finally { setRefreshing(false); }
  }, [meQ, summaryQ, salesQ]);

  if (meQ.isPending || merchantStallsQ.isPending) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Brand.blue} /></View>;
  }

  if (allStalls.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No stalls found</Text>
        <Text style={styles.mutedText}>You need a stall assignment to use POS.</Text>
      </View>
    );
  }

  const summary = summaryQ.data;
  const recentSales: POSSale[] = salesQ.data?.data ?? [];

  const renderSale = ({ item }: { item: POSSale }) => (
    <Pressable
      style={[styles.saleRow, cardShadow]}
      onPress={() => router.push({ pathname: '/pos/receipt/[saleId]', params: { saleId: item.id } })}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.saleReceipt}>#{item.receiptNumber ?? item.id.slice(0, 8)}</Text>
        <Text style={styles.saleMeta}>{fmtTime(item.createdAt)} · {item.paymentMethod}</Text>
      </View>
      <Text style={styles.saleAmt}>{formatMoney(item.totalAmount, 'USD')}</Text>
    </Pressable>
  );

  const header = (
    <View>
      {/* Stall header */}
      <View style={[styles.stallHeader, cardShadow]}>
        <Text style={styles.stallName}>{stall?.name ?? '—'}</Text>
        {allStalls.length > 1 && (
          <View style={styles.stallPicker}>
            {allStalls.map((s, i) => (
              <Pressable
                key={s.id}
                style={[styles.stallBtn, stallIndex === i && styles.stallBtnActive]}
                onPress={() => setStallIndex(i)}
              >
                <Text style={[styles.stallBtnText, stallIndex === i && styles.stallBtnTextActive]}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Daily summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, cardShadow]}>
          <Text style={styles.summaryLabel}>Today's revenue</Text>
          <Text style={styles.summaryBig}>{formatMoney(summary?.totalRevenue ?? 0, 'USD')}</Text>
        </View>
        <View style={[styles.summaryCard, cardShadow]}>
          <Text style={styles.summaryLabel}>Transactions</Text>
          <Text style={styles.summaryBig}>{summary?.totalTransactions ?? 0}</Text>
        </View>
      </View>

      {/* Open POS button */}
      <Pressable
        style={styles.openPosBtn}
        onPress={() => router.push({ pathname: '/pos/cart', params: { stallId: stall.id, stallName: stall.name } })}
      >
        <Text style={styles.openPosBtnText}>Open POS Register</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Recent sales</Text>
    </View>
  );

  return (
    <FlatList
      data={recentSales}
      keyExtractor={(item) => item.id}
      renderItem={renderSale}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      ListEmptyComponent={<Text style={styles.empty}>No sales yet today.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 40, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },

  stallHeader: { backgroundColor: Brand.navy, borderRadius: 16, padding: 18, marginBottom: 14 },
  stallName: { color: '#fff', fontSize: 20, fontWeight: '900' },
  stallPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  stallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  stallBtnActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  stallBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  stallBtnTextActive: { color: '#fff' },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: Brand.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase' },
  summaryBig: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginTop: 4 },

  openPosBtn: { backgroundColor: Brand.green, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  openPosBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: Brand.navy, marginBottom: 8 },
  saleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Brand.card, borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Brand.border,
  },
  saleReceipt: { fontSize: 14, fontWeight: '800', color: Brand.navy },
  saleMeta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  saleAmt: { fontSize: 16, fontWeight: '900', color: Brand.navy },

  empty: { textAlign: 'center', color: Brand.muted, marginTop: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  mutedText: { fontSize: 13, color: Brand.muted, marginTop: 6, textAlign: 'center' },
});
