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
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN'];

const STATUS_COLOR: Record<string, string> = {
  PENDING: Brand.orange,
  VERIFIED: Brand.green,
  SUSPENDED: Brand.red,
  DEACTIVATED: Brand.muted,
};

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

type Merchant = {
  id: string;
  businessName: string;
  status: string;
  createdAt: string;
  user?: { phone: string; firstName: string; lastName: string } | null;
};

type MerchantsPage = { data: Merchant[]; total: number; page: number; totalPages: number };

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); }
  catch { return iso; }
}

export default function AdminMerchantsScreen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.replace('/admin');
  }, [isAuthenticated, user]);

  const merchantsQ = useQuery({
    queryKey: ['admin-merchants', committed, page],
    enabled: isAuthenticated,
    queryFn: () =>
      api.get<MerchantsPage>('/api/v1/merchants', { params: { search: committed || undefined, page, limit: 20 } }).then((r) => r.data),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await merchantsQ.refetch(); } finally { setRefreshing(false); }
  }, [merchantsQ]);

  const doAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/api/v1/merchants/${id}/${action}`).then((r) => r.data),
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = { verify: 'Verified', suspend: 'Suspended', activate: 'Activated' };
      Alert.alert('Done', `Merchant ${labels[vars.action] ?? vars.action}.`);
      qc.invalidateQueries({ queryKey: ['admin-merchants'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message || 'Action failed.'),
    onSettled: () => setActioning(null),
  });

  function confirm(m: Merchant, action: 'verify' | 'suspend' | 'activate') {
    const labels = { verify: 'Verify', suspend: 'Suspend', activate: 'Activate' };
    Alert.alert(
      `${labels[action]} merchant?`,
      `${m.businessName}\n${m.user?.phone ?? ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: labels[action],
          style: action === 'suspend' ? 'destructive' : 'default',
          onPress: () => { setActioning(m.id); doAction.mutate({ id: m.id, action }); },
        },
      ],
    );
  }

  const renderMerchant = ({ item }: { item: Merchant }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardMain}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.businessName}</Text>
          {item.user && <Text style={styles.meta}>{item.user.firstName} {item.user.lastName} · {item.user.phone}</Text>}
          <Text style={styles.meta}>Joined {fmtDate(item.createdAt)}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: (STATUS_COLOR[item.status] ?? Brand.muted) + '22' }]}>
          <Text style={[styles.pillText, { color: STATUS_COLOR[item.status] ?? Brand.muted }]}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {item.status === 'PENDING' && (
          <Pressable style={[styles.actionBtn, styles.successBtn, actioning === item.id && styles.btnDisabled]}
            onPress={() => confirm(item, 'verify')} disabled={actioning === item.id}>
            {actioning === item.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnText}>✓ Verify</Text>}
          </Pressable>
        )}
        {item.status !== 'SUSPENDED' && item.status !== 'PENDING' && (
          <Pressable style={[styles.actionBtn, styles.dangerBtn, actioning === item.id && styles.btnDisabled]}
            onPress={() => confirm(item, 'suspend')} disabled={actioning === item.id}>
            <Text style={styles.actionBtnText}>Suspend</Text>
          </Pressable>
        )}
        {item.status === 'SUSPENDED' && (
          <Pressable style={[styles.actionBtn, styles.blueBtn, actioning === item.id && styles.btnDisabled]}
            onPress={() => confirm(item, 'activate')} disabled={actioning === item.id}>
            <Text style={styles.actionBtnText}>Activate</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const total = merchantsQ.data?.total ?? 0;
  const totalPages = merchantsQ.data?.totalPages ?? 1;

  return (
    <View style={styles.flex}>
      <View style={styles.searchBar}>
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
          placeholder="Search by name or phone…" placeholderTextColor={Brand.muted}
          returnKeyType="search" onSubmitEditing={() => { setCommitted(search); setPage(1); }}
          clearButtonMode="while-editing" />
        <Pressable style={styles.searchBtn} onPress={() => { setCommitted(search); setPage(1); }}>
          <Text style={styles.searchBtnText}>Go</Text>
        </Pressable>
      </View>

      {merchantsQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
      ) : (
        <FlatList
          data={merchantsQ.data?.data ?? []}
          keyExtractor={(item: Merchant) => item.id}
          renderItem={renderMerchant}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
          ListHeaderComponent={<Text style={styles.count}>{total} merchant{total !== 1 ? 's' : ''}</Text>}
          ListFooterComponent={totalPages > 1 ? (
            <View style={styles.pagination}>
              <Pressable style={[styles.pageBtn, page <= 1 && styles.btnDisabled]} onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <Text style={styles.pageBtnText}>← Prev</Text>
              </Pressable>
              <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
              <Pressable style={[styles.pageBtn, page >= totalPages && styles.btnDisabled]} onPress={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                <Text style={styles.pageBtnText}>Next →</Text>
              </Pressable>
            </View>
          ) : null}
          ListEmptyComponent={<Text style={styles.empty}>No merchants found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  searchBar: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border },
  searchInput: { flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.text, backgroundColor: Brand.pageBg },
  searchBtn: { backgroundColor: Brand.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  list: { padding: 12, paddingBottom: 40 },
  count: { fontSize: 12, color: Brand.muted, marginBottom: 8 },
  card: { backgroundColor: Brand.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Brand.border },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  meta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  dangerBtn: { backgroundColor: Brand.red },
  successBtn: { backgroundColor: Brand.green },
  blueBtn: { backgroundColor: Brand.primary },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  pageBtn: { backgroundColor: Brand.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  pageBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pageInfo: { fontSize: 13, color: Brand.muted, fontWeight: '700' },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },
});
