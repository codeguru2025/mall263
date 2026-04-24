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

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

type ReportCard = { label: string; value: string; color: string; bg: string };

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
  const statsQ = useQuery({ queryKey: ['admin-dashboard'], queryFn: fetchDashboard, enabled: canLoad });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await statsQ.refetch(); } finally { setRefreshing(false); }
  }, [statsQ]);

  const s = statsQ.data;
  const reportCards: ReportCard[] = s
    ? [
        { label: 'Total users', value: String(s.users), color: Brand.blue, bg: 'rgba(59, 154, 225, 0.12)' },
        { label: 'Merchants', value: String(s.merchants), color: Brand.green, bg: 'rgba(67, 160, 71, 0.12)' },
        { label: 'Products', value: String(s.products), color: '#1B2A4A', bg: 'rgba(27, 42, 74, 0.08)' },
        { label: 'Total sales', value: String(s.sales), color: '#43A047', bg: 'rgba(67, 160, 71, 0.1)' },
        {
          label: 'Commission',
          value: formatMoney(s.totalCommissionRevenue, 'USD'),
          color: '#C62828',
          bg: 'rgba(198, 40, 40, 0.08)',
        },
        { label: 'Open demands', value: String(s.openDemands), color: Brand.orange, bg: 'rgba(247, 148, 29, 0.12)' },
      ]
    : [];

  if (!canLoad) return null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />
      }
    >
      <Pressable onPress={() => router.replace('/admin' as never)} style={styles.backRow} hitSlop={8}>
        <Text style={styles.backText}>‹ Admin</Text>
      </Pressable>
      <Text style={styles.heading}>Platform reports</Text>
      <Text style={styles.sub}>Sales, commission, and user stats (same as web /reports)</Text>

      {statsQ.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Brand.blue} />
        </View>
      ) : (
        <View style={styles.grid}>
          {reportCards.map((c) => (
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
  backText: { fontSize: 15, fontWeight: '800', color: Brand.blue },
  heading: { fontSize: 22, fontWeight: '900', color: Brand.navy, marginBottom: 4 },
  sub: { fontSize: 13, color: Brand.muted, marginBottom: 20 },
  centered: { paddingVertical: 40, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    minWidth: 150,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  cardValue: { fontSize: 22, fontWeight: '900' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 4, textTransform: 'uppercase' },
});
