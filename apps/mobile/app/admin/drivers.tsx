import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS'];
const TIERS = ['ONBOARDING', 'TRUSTED', 'ELITE'];

const TIER_COLOR: Record<string, string> = {
  ONBOARDING: Brand.muted,
  TRUSTED: Brand.primary,
  ELITE: '#D97706',
};

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

type Driver = {
  id: string;
  tier: string;
  kycStatus: string;
  totalEarnings: unknown;
  floatBalance: unknown;
  isActive: boolean;
  user?: { firstName: string; lastName: string; phone: string } | null;
};

function fmt(v: unknown) {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? '$0.00' : `$${n.toFixed(2)}`;
}

export default function AdminDriversScreen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.replace('/admin');
  }, [isAuthenticated, user]);

  const driversQ = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: () => api.get<Driver[]>('/api/v1/drivers').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await driversQ.refetch(); } finally { setRefreshing(false); }
  }, [driversQ]);

  const approveKyc = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/drivers/${id}/kyc-approve`).then((r) => r.data),
    onSuccess: () => { Alert.alert('Done', 'KYC approved.'); qc.invalidateQueries({ queryKey: ['admin-drivers'] }); },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
    onSettled: () => setActioning(null),
  });

  const setTier = useMutation({
    mutationFn: ({ id, tier }: { id: string; tier: string }) =>
      api.patch(`/api/v1/drivers/${id}/tier`, { tier }).then((r) => r.data),
    onSuccess: () => { Alert.alert('Done', 'Tier updated.'); qc.invalidateQueries({ queryKey: ['admin-drivers'] }); },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
    onSettled: () => setActioning(null),
  });

  function confirmKyc(d: Driver) {
    Alert.alert(
      'Approve KYC?',
      `${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''} (${d.user?.phone ?? ''})`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => { setActioning(d.id); approveKyc.mutate(d.id); } },
      ],
    );
  }

  function pickTier(d: Driver) {
    Alert.alert('Set Driver Tier', `Current: ${d.tier}`, [
      { text: 'Cancel', style: 'cancel' },
      ...TIERS.filter((t) => t !== d.tier).map((t) => ({
        text: t,
        onPress: () => { setActioning(d.id); setTier.mutate({ id: d.id, tier: t }); },
      })),
    ]);
  }

  const renderDriver = ({ item }: { item: Driver }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.user?.firstName ?? 'Driver'} {item.user?.lastName ?? ''}</Text>
          <Text style={styles.meta}>{item.user?.phone}</Text>
          <Text style={styles.meta}>Earnings: {fmt(item.totalEarnings)} · Float: {fmt(item.floatBalance)}</Text>
        </View>
        <View style={styles.badges}>
          <View style={[styles.pill, { backgroundColor: (TIER_COLOR[item.tier] ?? Brand.muted) + '22' }]}>
            <Text style={[styles.pillText, { color: TIER_COLOR[item.tier] ?? Brand.muted }]}>{item.tier}</Text>
          </View>
          {item.kycStatus !== 'APPROVED' && (
            <View style={[styles.pill, { backgroundColor: Brand.orange + '22', marginTop: 4 }]}>
              <Text style={[styles.pillText, { color: Brand.orange }]}>KYC {item.kycStatus}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {item.kycStatus !== 'APPROVED' && (
          <Pressable
            style={[styles.actionBtn, styles.successBtn, actioning === item.id && styles.btnDisabled]}
            onPress={() => confirmKyc(item)}
            disabled={actioning === item.id}
          >
            {actioning === item.id
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.actionBtnText}>✓ Approve KYC</Text>}
          </Pressable>
        )}
        <Pressable
          style={[styles.actionBtn, styles.blueBtn, actioning === item.id && styles.btnDisabled]}
          onPress={() => pickTier(item)}
          disabled={actioning === item.id}
        >
          <Text style={styles.actionBtnText}>Set Tier</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.flex}>
      {driversQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
      ) : (
        <FlatList
          data={driversQ.data ?? []}
          keyExtractor={(item: Driver) => item.id}
          renderItem={renderDriver}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
          ListHeaderComponent={<Text style={styles.count}>{driversQ.data?.length ?? 0} driver{driversQ.data?.length !== 1 ? 's' : ''}</Text>}
          ListEmptyComponent={<Text style={styles.empty}>No drivers registered yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  list: { padding: 12, paddingBottom: 40 },
  count: { fontSize: 12, color: Brand.muted, marginBottom: 8 },
  card: { backgroundColor: Brand.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Brand.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  meta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  badges: { alignItems: 'flex-end' },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  dangerBtn: { backgroundColor: Brand.red },
  successBtn: { backgroundColor: Brand.green },
  blueBtn: { backgroundColor: Brand.primary },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },
});
