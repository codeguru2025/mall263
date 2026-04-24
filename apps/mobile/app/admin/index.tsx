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
import { Brand } from '@/constants/brand';
import { fetchDashboard } from '@/lib/admin-api';
import { formatMoney } from '@/lib/products';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminConsoleDashboardRole } from '@mall263/shared';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }
    : { elevation: 2 };

type StatTile = { label: string; value: string | number; color: string };

export default function AdminDashboard() {
  const { isAuthenticated, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (!user) return;
    if (user.role === 'SUPPORT_ADMIN') { router.replace('/admin/support'); return; }
    if (user.role === 'MALL_MANAGER') { router.replace('/admin/malls'); return; }
    if (!isAdminConsoleDashboardRole(user.role)) router.replace('/(tabs)');
  }, [isAuthenticated, user]);

  const statsQ = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchDashboard,
    enabled: isAuthenticated && isAdminConsoleDashboardRole(user?.role),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await statsQ.refetch(); } finally { setRefreshing(false); }
  }, [statsQ]);

  const s = statsQ.data;

  if (user && !isAdminConsoleDashboardRole(user.role)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.blue} />
      </View>
    );
  }

  const tiles: StatTile[] = [
    { label: 'Users', value: s?.users ?? '—', color: Brand.blue },
    { label: 'Merchants', value: s?.merchants ?? '—', color: Brand.green },
    { label: 'Products', value: s?.products ?? '—', color: Brand.navy },
    { label: 'Sales', value: s?.sales ?? '—', color: '#7C3AED' },
    { label: 'Commission', value: s ? formatMoney(s.totalCommissionRevenue, 'USD') : '—', color: Brand.green },
    { label: 'Open demands', value: s?.openDemands ?? '—', color: Brand.orange },
  ];

  const navItems = [
    { label: 'Reports', icon: '📈', route: '/admin/reports' as const },
    { label: 'Users', icon: '👤', route: '/admin/users' as const },
    { label: 'Stalls', icon: '🏪', route: '/admin/stalls' as const },
    { label: 'Merchants', icon: '🏬', route: '/admin/merchants' as const },
    { label: 'Drivers', icon: '🚗', route: '/admin/drivers' as const },
    { label: 'Subscriptions', icon: '📋', route: '/admin/subscriptions' as const },
    { label: 'Sub Plans', icon: '💳', route: '/admin/subscription-plans' as const },
    { label: 'Deliveries', icon: '🚚', route: '/admin/deliveries' as const },
    { label: 'Promotions', icon: '🏷', route: '/admin/promotions' as const },
    { label: 'Ads', icon: '📢', route: '/admin/ads' as const },
    { label: 'Malls', icon: '🏛', route: '/admin/malls' as const },
    { label: 'Categories', icon: '🏷️', route: '/admin/categories' as const },
    { label: 'Disputes', icon: '⚖️', route: '/admin/disputes' as const },
    { label: 'Support', icon: '💬', route: '/admin/support' as const },
    { label: 'Settings', icon: '⚙️', route: '/admin/settings' as const },
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
          onPress={() => router.push(item.route as never)}
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
