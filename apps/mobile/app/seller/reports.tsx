import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { fetchMeProfile } from '@/lib/me-profile';
import { fetchStallsByMerchant } from '@/lib/seller-api';
import { fetchStallReport } from '@/lib/seller-ops-api';
import { Brand } from '@/constants/brand';

function fmt(v: unknown, currency = 'USD') {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

function rangeDates(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

const RANGES: { key: number; label: string }[] = [
  { key: 7, label: '7d' },
  { key: 30, label: '30d' },
  { key: 90, label: '90d' },
];

export default function SellerReportsScreen() {
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });
  const merchantId = meQ.data?.merchant?.id;
  const stallsQ = useQuery({
    queryKey: ['my-stalls', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });
  const stallId = stallsQ.data?.[0]?.id;

  const { start, end } = useMemo(() => rangeDates(days), [days]);

  const reportQ = useQuery({
    queryKey: ['stall-report', stallId, days],
    queryFn: () => fetchStallReport(stallId!, start, end),
    enabled: !!stallId,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await reportQ.refetch();
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
        <FontAwesome name="bar-chart" size={30} color={Brand.muted} />
        <Text style={styles.emptyTitle}>No stall yet</Text>
        <Text style={styles.emptySub}>Set up your stall to see reports.</Text>
      </View>
    );
  }

  const r = reportQ.data;
  const revenue = r?.summary?.totalRevenue ?? 0;
  const netRevenue = r?.summary?.netProfit != null
    ? Number(r.summary.totalRevenue ?? 0) - Number(r.summary.totalCommission ?? 0)
    : Number(revenue);
  const salesCount = r?.summary?.totalSales ?? 0;
  const avgOrder = r?.summary?.avgOrderValue ?? 0;
  const expenses = r?.expenses?.total ?? 0;
  const profit = r?.summary?.profitAfterExpenses ?? (Number(netRevenue) || 0) - (Number(expenses) || 0);
  const expensesByCategory = r?.expenses?.byCategory ?? [];
  const visits = r?.engagement?.storePageViews ?? 0;
  const insights = r?.insights ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.rangeBar}>
        {RANGES.map((rg) => (
          <Pressable
            key={rg.key}
            style={[styles.rangeBtn, days === rg.key && styles.rangeBtnActive]}
            onPress={() => setDays(rg.key)}
          >
            <Text style={[styles.rangeBtnText, days === rg.key && styles.rangeBtnTextActive]}>
              {rg.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {reportQ.isPending ? (
        <ActivityIndicator color={Brand.blue} style={{ marginTop: 40 }} />
      ) : reportQ.isError ? (
        <Text style={styles.error}>Could not load report. Pull to refresh.</Text>
      ) : (
        <>
          <View style={styles.profitCard}>
            <Text style={styles.profitLabel}>Profit (last {days} days)</Text>
            <Text style={[styles.profitAmount, Number(profit) < 0 && { color: '#fca5a5' }]}>
              {fmt(profit)}
            </Text>
            <Text style={styles.profitSub}>
              Revenue {fmt(netRevenue)} − Expenses {fmt(expenses)}
            </Text>
          </View>

          <View style={styles.metricsGrid}>
            <Metric label="Total revenue" value={fmt(revenue)} icon="money" color="#16a34a" />
            <Metric label="Net revenue" value={fmt(netRevenue)} icon="line-chart" color={Brand.blue} />
            <Metric label="Sales" value={String(salesCount)} icon="shopping-cart" color="#ea580c" />
            <Metric label="Avg order" value={fmt(avgOrder)} icon="calculator" color="#7c3aed" />
            <Metric label="Expenses" value={fmt(expenses)} icon="minus-circle" color="#b91c1c" />
            <Metric label="Store visits" value={String(visits)} icon="eye" color="#0891b2" />
          </View>

          {Array.isArray(expensesByCategory) && expensesByCategory.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Expenses by category</Text>
              {expensesByCategory.map((item) => (
                <View key={item.category} style={styles.catRow}>
                  <Text style={styles.catLabel}>{item.category.replace(/_/g, ' ').toLowerCase()}</Text>
                  <Text style={styles.catAmount}>{fmt(item.total)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {insights.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Insights</Text>
              {insights.map((ins, i) => (
                <View key={ins.id ?? i} style={styles.insightRow}>
                  <FontAwesome name="lightbulb-o" size={14} color={Brand.blue} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    {ins.title ? <Text style={styles.insightTitle}>{ins.title}</Text> : null}
                    {(ins.detail ?? ins.description) ? (
                      <Text style={styles.insightText}>{ins.detail ?? ins.description}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Metric({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}1a` }]}>
        <FontAwesome name={icon} size={14} color={color} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 14, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: Brand.pageBg,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  emptySub: { fontSize: 12, color: Brand.muted, textAlign: 'center' },
  error: { textAlign: 'center', color: Brand.red, padding: 20, fontSize: 13 },

  rangeBar: {
    flexDirection: 'row',
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 14,
  },
  rangeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  rangeBtnActive: { backgroundColor: Brand.blue },
  rangeBtnText: { fontSize: 12, fontWeight: '800', color: Brand.muted },
  rangeBtnTextActive: { color: '#fff' },

  profitCard: {
    backgroundColor: Brand.navy,
    padding: 20,
    borderRadius: 18,
    marginBottom: 12,
  },
  profitLabel: {
    color: '#ffffff99',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  profitAmount: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 6, letterSpacing: -0.6 },
  profitSub: { color: '#ffffffcc', fontSize: 12, marginTop: 6 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricLabel: { fontSize: 11, color: Brand.muted, fontWeight: '700' },
  metricValue: { fontSize: 18, fontWeight: '900', color: Brand.navy, marginTop: 2, letterSpacing: -0.3 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    marginTop: 12,
  },
  cardTitle: { fontSize: 13, fontWeight: '900', color: Brand.navy, marginBottom: 10 },

  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  catLabel: { fontSize: 13, color: Brand.text, textTransform: 'capitalize' },
  catAmount: { fontSize: 13, fontWeight: '800', color: Brand.navy },

  insightRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  insightTitle: { fontSize: 13, fontWeight: '800', color: Brand.navy, marginBottom: 2 },
  insightText: { fontSize: 12, color: Brand.muted, lineHeight: 17 },
});
