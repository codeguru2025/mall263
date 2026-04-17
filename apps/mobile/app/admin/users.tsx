import { useCallback, useState } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import {
  fetchAdminUsers,
  suspendUser,
  activateUser,
  type AdminUser,
} from '@/lib/admin-api';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: Brand.green,
  SUSPENDED: Brand.red,
  PENDING: Brand.orange,
  INACTIVE: Brand.muted,
};

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); }
  catch { return iso; }
}

export default function AdminUsersScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const usersQ = useQuery({
    queryKey: ['admin-users', committed, page],
    queryFn: () => fetchAdminUsers(committed, page),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await usersQ.refetch(); } finally { setRefreshing(false); }
  }, [usersQ]);

  const handleAction = async (user: AdminUser, action: 'suspend' | 'activate') => {
    Alert.alert(
      action === 'suspend' ? 'Suspend user?' : 'Activate user?',
      `${user.firstName} ${user.lastName} (${user.phone})`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'suspend' ? 'Suspend' : 'Activate',
          style: action === 'suspend' ? 'destructive' : 'default',
          onPress: async () => {
            setActioning(user.id);
            try {
              if (action === 'suspend') await suspendUser(user.id);
              else await activateUser(user.id);
              await qc.invalidateQueries({ queryKey: ['admin-users'] });
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Action failed.');
            } finally {
              setActioning(null);
            }
          },
        },
      ],
    );
  };

  const renderUser = ({ item }: { item: AdminUser }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardMain}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.phone}>{item.phone}</Text>
          <Text style={styles.meta}>{item.role} · Joined {fmtDate(item.createdAt)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: (STATUS_COLOR[item.status] ?? Brand.muted) + '22' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] ?? Brand.muted }]}>
            {item.status}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {item.status !== 'SUSPENDED' ? (
          <Pressable
            style={[styles.actionBtn, styles.dangerBtn, actioning === item.id && styles.btnDisabled]}
            onPress={() => handleAction(item, 'suspend')}
            disabled={actioning === item.id}
          >
            {actioning === item.id
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.actionBtnText}>Suspend</Text>}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.actionBtn, styles.successBtn, actioning === item.id && styles.btnDisabled]}
            onPress={() => handleAction(item, 'activate')}
            disabled={actioning === item.id}
          >
            {actioning === item.id
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.actionBtnText}>Activate</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );

  const total = usersQ.data?.total ?? 0;
  const totalPages = usersQ.data?.totalPages ?? 1;

  return (
    <View style={styles.flex}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or phone…"
          placeholderTextColor={Brand.muted}
          returnKeyType="search"
          onSubmitEditing={() => { setCommitted(search); setPage(1); }}
          clearButtonMode="while-editing"
        />
        <Pressable style={styles.searchBtn} onPress={() => { setCommitted(search); setPage(1); }}>
          <Text style={styles.searchBtnText}>Go</Text>
        </Pressable>
      </View>

      {usersQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.blue} /></View>
      ) : (
        <FlatList
          data={usersQ.data?.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
          ListHeaderComponent={
            <Text style={styles.resultCount}>{total} user{total !== 1 ? 's' : ''}</Text>
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable
                  style={[styles.pageBtn, page <= 1 && styles.btnDisabled]}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <Text style={styles.pageBtnText}>← Prev</Text>
                </Pressable>
                <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
                <Pressable
                  style={[styles.pageBtn, page >= totalPages && styles.btnDisabled]}
                  onPress={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                >
                  <Text style={styles.pageBtnText}>Next →</Text>
                </Pressable>
              </View>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  searchBar: {
    flexDirection: 'row', gap: 10, padding: 12,
    backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.text,
    backgroundColor: Brand.pageBg,
  },
  searchBtn: { backgroundColor: Brand.blue, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  list: { padding: 12, paddingBottom: 40 },
  resultCount: { fontSize: 12, color: Brand.muted, marginBottom: 8 },
  card: {
    backgroundColor: Brand.card, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Brand.border,
  },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  phone: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  meta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  dangerBtn: { backgroundColor: Brand.red },
  successBtn: { backgroundColor: Brand.green },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },

  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  pageBtn: { backgroundColor: Brand.blue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  pageBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pageInfo: { fontSize: 13, color: Brand.muted, fontWeight: '700' },

  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },
});
