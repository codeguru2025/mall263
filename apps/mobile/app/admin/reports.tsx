import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { isAdminConsoleDashboardRole } from '@mall263/shared';
import { Brand } from '@/constants/brand';
import { fetchDashboard } from '@/lib/admin-api';
import { formatMoney } from '@/lib/products';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

type ReportCard = { label: string; value: string; color: string; bg: string };

interface PlatformReport {
  totalRevenue?: number;
  totalCommission?: number;
  totalOrders?: number;
  totalDeliveries?: number;
  activeSubscriptions?: number;
  totalDisputes?: number;
  resolvedDisputes?: number;
  [key: string]: unknown;
}

export default function AdminPlatformReports() {
  const { isAuthenticated, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (!user) return;
    if (user.role === 'SUPPORT_ADMIN') { router.replace('/admin/support'); return; }
    if (user.role === 'MALL_MANAGER') { router.replace('/admin/malls'); return; }
    if (!isAdminConsoleDashboardRole(user.role)) router.replace('/(tabs)');
  }, [isAuthenticated, user]);

  const canLoad = isAuthenticated && isAdminConsoleDashboardRole(user?.role);

  const dashQ = useQuery({ queryKey: ['admin-dashboard'], queryFn: fetchDashboard, enabled: canLoad });

  const platformQ = useQuery<PlatformReport>({
    queryKey: ['platform-report'],
    queryFn: () => api.get('/api/v1/reports/platform').then((r) => r.data),
    enabled: canLoad,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([dashQ.refetch(), platformQ.refetch()]); } finally { setRefreshing(false); }
  }, [dashQ, platformQ]);

  const s = dashQ.data;
  const p = platformQ.data;

  const dashCards: ReportCard[] = s
    ? [
        { label: 'Total users', value: String(s.users), color: Brand.blue, bg: 'rgba(0,100,0,0.08)' },
        { label: 'Merchants', value: String(s.merchants), color: Brand.green, bg: 'rgba(67,160,71,0.10)' },
        { label: 'Products', value: String(s.products), color: Brand.navy, bg: 'rgba(27,42,74,0.08)' },
        { label: 'Total sales', value: String(s.sales), color: '#43A047', bg: 'rgba(67,160,71,0.10)' },
        { label: 'Commission earned', value: formatMoney(s.totalCommissionRevenue, 'USD'), color: '#C62828', bg: 'rgba(198,40,40,0.08)' },
        { label: 'Open demands', value: String(s.openDemands), color: Brand.orange, bg: 'rgba(247,148,29,0.10)' },
      ]
    : [];

  const platformCards: ReportCard[] = p
    ? Object.entries(p)
        .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
        .map(([key, val]) => {
          const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').toLowerCase().trim();
          const value = typeof val === 'number' && key.toLowerCase().includes('revenue') || key.toLowerCase().includes('commission')
            ? formatMoney(val as number, 'USD')
            : String(val);
          return { label, value, color: Brand.navy, bg: Brand.card };
        })
    : [];

  if (!canLoad) return null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
    >
      <Pressable onPress={() => router.replace('/admin' as never)} style={styles.backRow} hitSlop={8}>
        <Text style={styles.backText}>‹ Admin</Text>
      </Pressable>
      <Text style={styles.heading}>Platform Reports</Text>

      {/* Dashboard overview */}
      <Text style={styles.sectionTitle}>Dashboard overview</Text>
      {dashQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
      ) : (
        <View style={styles.grid}>
          {dashCards.map((c) => (
            <View key={c.label} style={[styles.card, cardShadow, { backgroundColor: c.bg }]}>
              <Text style={[styles.cardValue, { color: c.color }]}>{c.value}</Text>
              <Text style={styles.cardLabel}>{c.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Platform financial report */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Financial report</Text>
      {platformQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
      ) : platformQ.isError ? (
        <Text style={styles.errorText}>Could not load financial report.</Text>
      ) : platformCards.length === 0 ? (
        <Text style={styles.muted}>No data available.</Text>
      ) : (
        <View style={styles.grid}>
          {platformCards.map((c) => (
            <View key={c.label} style={[styles.card, cardShadow, { backgroundColor: c.bg }]}>
              <Text style={[styles.cardValue, { color: c.color }]}>{c.value}</Text>
              <Text style={styles.cardLabel}>{c.label}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 40 },
  backRow: { marginBottom: 8, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '800', color: Brand.primary },
  heading: { fontSize: 22, fontWeight: '900', color: Brand.navy, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  centered: { paddingVertical: 24, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  card: { width: '47%', minWidth: 150, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Brand.border },
  cardValue: { fontSize: 22, fontWeight: '900' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 4, textTransform: 'uppercase' },
  errorText: { fontSize: 13, color: Brand.red, fontWeight: '700' },
  muted: { fontSize: 13, color: Brand.muted },
});
