import { useCallback, useState } from 'react';
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
import { Brand } from '@/constants/brand';
import { fetchDashboard } from '@/lib/admin-api';
import { formatMoney } from '@/lib/products';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

type StatTile = { label: string; value: string | number; color: string };

export default function AdminDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const statsQ = useQuery({ queryKey: ['admin-dashboard'], queryFn: fetchDashboard });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await statsQ.refetch(); } finally { setRefreshing(false); }
  }, [statsQ]);

  const s = statsQ.data;

  const tiles: StatTile[] = [
    { label: 'Users', value: s?.totalUsers ?? '—', color: Brand.blue },
    { label: 'Active stalls', value: s?.activeStalls ?? '—', color: Brand.green },
    { label: 'Pending stalls', value: s?.pendingStalls ?? '—', color: Brand.orange },
    { label: 'Products', value: s?.totalProducts ?? '—', color: Brand.navy },
    { label: 'Sales', value: s?.totalSales ?? '—', color: '#7C3AED' },
    { label: 'Revenue', value: s ? formatMoney(s.totalRevenue, 'USD') : '—', color: Brand.green },
  ];

  const navItems = [
    { label: 'Users', icon: '👤', route: '/admin/users' as const },
    { label: 'Stalls', icon: '🏪', route: '/admin/stalls' as const },
    { label: 'Subscriptions', icon: '📋', route: '/admin/subscriptions' as const },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
    >
      <Text style={styles.heading}>Admin Dashboard</Text>

      {statsQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.blue} /></View>
      ) : (
        <View style={styles.statsGrid}>
          {tiles.map((t) => (
            <View key={t.label} style={[styles.statCard, cardShadow]}>
              <Text style={[styles.statValue, { color: t.color }]}>{t.value}</Text>
              <Text style={styles.statLabel}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Manage</Text>
      {navItems.map((item) => (
        <Pressable
          key={item.route}
          style={[styles.navCard, cardShadow]}
          onPress={() => router.push(item.route)}
        >
          <Text style={styles.navIcon}>{item.icon}</Text>
          <Text style={styles.navLabel}>{item.label}</Text>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 40 },
  centered: { paddingVertical: 40, alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '900', color: Brand.navy, marginBottom: 16 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, minWidth: '44%', backgroundColor: Brand.card,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border,
  },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 2, textTransform: 'uppercase' },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  navCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Brand.card, borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: Brand.border,
  },
  navIcon: { fontSize: 22 },
  navLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: Brand.navy },
  navArrow: { fontSize: 22, color: Brand.muted, fontWeight: '300' },
});
