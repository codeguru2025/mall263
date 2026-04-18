import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { fetchMeProfile } from '@/lib/me-profile';
import { fetchStallsByMerchant } from '@/lib/seller-api';
import {
  fetchPosDailySummary,
  fetchPosSales,
  type POSSaleRow,
} from '@/lib/seller-ops-api';
import { Brand } from '@/constants/brand';

function fmt(v: unknown, currency = 'USD') {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

function rangeDates(key: RangeKey): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (key === 'today') start.setHours(0, 0, 0, 0);
  else if (key === 'week') start.setDate(start.getDate() - 7);
  else start.setDate(start.getDate() - 30);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function SellerSalesScreen() {
  const [range, setRange] = useState<RangeKey>('today');
  const [refreshing, setRefreshing] = useState(false);

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });
  const merchantId = meQ.data?.merchant?.id;

  const stallsQ = useQuery({
    queryKey: ['my-stalls', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });

  const stallId = stallsQ.data?.[0]?.id;
  const { start, end } = useMemo(() => rangeDates(range), [range]);

  const salesQ = useQuery({
    queryKey: ['pos-sales', stallId, range],
    queryFn: () =>
      fetchPosSales(stallId!, { startDate: start, endDate: end, limit: 100 }),
    enabled: !!stallId,
  });

  const summaryQ = useQuery({
    queryKey: ['pos-summary', stallId, range === 'today' ? 'today' : null],
    queryFn: () => fetchPosDailySummary(stallId!),
    enabled: !!stallId && range === 'today',
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([salesQ.refetch(), summaryQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (meQ.isPending || stallsQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.blue} size="large" />
      </View>
    );
  }

  if (!stallId) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="shopping-bag" size={30} color={Brand.muted} />
        <Text style={styles.emptyTitle}>No stall yet</Text>
        <Text style={styles.emptySub}>Set up your stall to start recording sales.</Text>
      </View>
    );
  }

  const totalRevenue = salesQ.data?.reduce((sum, s) => {
    const n = Number(s.totalAmount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0) ?? 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={salesQ.data ?? []}
        keyExtractor={(s: { id: string }) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Revenue · {RANGES.find((r) => r.key === range)?.label}</Text>
              <Text style={styles.summaryAmount}>{fmt(totalRevenue)}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>{salesQ.data?.length ?? 0} sales</Text>
                {summaryQ.data?.totalCommission ? (
                  <>
                    <Text style={styles.summaryDot}>·</Text>
                    <Text style={styles.summaryItem}>
                      {fmt(summaryQ.data.totalCommission)} commission
                    </Text>
                  </>
                ) : null}
              </View>
            </View>

            <View style={styles.rangeBar}>
              {RANGES.map((r) => (
                <Pressable
                  key={r.key}
                  style={[styles.rangeBtn, range === r.key && styles.rangeBtnActive]}
                  onPress={() => setRange(r.key)}
                >
                  <Text style={[styles.rangeBtnText, range === r.key && styles.rangeBtnTextActive]}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Sales</Text>
          </>
        }
        renderItem={({ item }: { item: POSSaleRow }) => <SaleRow sale={item} />}
        ListEmptyComponent={
          salesQ.isPending ? (
            <ActivityIndicator color={Brand.blue} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.emptyBox}>
              <FontAwesome name="shopping-cart" size={28} color={Brand.muted} />
              <Text style={styles.emptyTitle}>No sales yet</Text>
              <Text style={styles.emptySub}>
                Your POS sales will appear here once you process them.
              </Text>
              <Pressable style={styles.posBtn} onPress={() => router.push('/pos')}>
                <FontAwesome name="plus" size={12} color="#fff" />
                <Text style={styles.posBtnText}>Open POS</Text>
              </Pressable>
            </View>
          )
        }
      />
    </View>
  );
}

function SaleRow({ sale }: { sale: POSSaleRow }) {
  const time = new Date(sale.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isRefunded = sale.status === 'REFUNDED';
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: '/pos/receipt/[saleId]', params: { saleId: sale.id } })}
    >
      <View style={styles.rowIcon}>
        <FontAwesome
          name={isRefunded ? 'undo' : 'check'}
          size={14}
          color={isRefunded ? '#b91c1c' : '#16a34a'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowAmount}>{fmt(sale.totalAmount, sale.currency ?? 'USD')}</Text>
        <Text style={styles.rowMeta}>
          {sale.receiptNumber} · {sale.paymentMethod?.toLowerCase() ?? 'cash'} · {time}
        </Text>
      </View>
      <FontAwesome name="chevron-right" size={12} color={Brand.muted} />
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
    gap: 8,
  },
  listContent: { padding: 14, paddingBottom: 40 },

  summaryCard: {
    backgroundColor: Brand.navy,
    padding: 20,
    borderRadius: 18,
    marginBottom: 12,
  },
  summaryLabel: {
    color: '#ffffff99',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryAmount: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 6, letterSpacing: -0.6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  summaryItem: { color: '#ffffffcc', fontSize: 12, fontWeight: '600' },
  summaryDot: { color: '#ffffffaa', marginHorizontal: 6 },

  rangeBar: {
    flexDirection: 'row',
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 14,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  rangeBtnActive: { backgroundColor: Brand.blue },
  rangeBtnText: { fontSize: 12, fontWeight: '800', color: Brand.muted },
  rangeBtnTextActive: { color: '#fff' },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: Brand.navy,
    marginBottom: 8,
    marginLeft: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 8,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Brand.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAmount: { fontSize: 15, fontWeight: '900', color: Brand.navy },
  rowMeta: { fontSize: 11, color: Brand.muted, marginTop: 2 },

  emptyBox: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 14,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  emptySub: { fontSize: 12, color: Brand.muted, textAlign: 'center', lineHeight: 17 },

  posBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.blue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  posBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
