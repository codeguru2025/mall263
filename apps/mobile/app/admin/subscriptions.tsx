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
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import {
  fetchAdminSubscriptions,
  extendTrial,
  grantFreeMonth,
  type AdminSubscription,
} from '@/lib/admin-api';

const STATUS_COLOR: Record<string, string> = {
  TRIAL: Brand.blue,
  ACTIVE: Brand.green,
  EXPIRED: Brand.red,
  CANCELLED: Brand.muted,
  GRACE: Brand.orange,
};

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); }
  catch { return iso; }
}

export default function AdminSubscriptionsScreen() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const subsQ = useQuery({
    queryKey: ['admin-subscriptions', page],
    queryFn: () => fetchAdminSubscriptions(page),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await subsQ.refetch(); } finally { setRefreshing(false); }
  }, [subsQ]);

  const handleExtendTrial = (sub: AdminSubscription) => {
    Alert.prompt(
      'Extend trial',
      `Days to add for ${sub.user.firstName} ${sub.user.lastName}:`,
      async (input) => {
        const days = parseInt(input ?? '7', 10);
        if (!days || days < 1) { Alert.alert('Invalid', 'Enter a positive number of days.'); return; }
        setActioning(sub.user.id);
        try {
          await extendTrial(sub.user.id, days);
          await qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
          Alert.alert('Done', `Trial extended by ${days} day${days !== 1 ? 's' : ''}.`);
        } catch (err: any) {
          Alert.alert('Error', err?.response?.data?.message || 'Failed.');
        } finally {
          setActioning(null);
        }
      },
      'plain-text',
      '7',
      'number-pad',
    );
  };

  const handleGrantMonth = (sub: AdminSubscription) => {
    Alert.alert(
      'Grant free month?',
      `${sub.user.firstName} ${sub.user.lastName} (${sub.user.phone})`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Grant',
          onPress: async () => {
            setActioning(sub.user.id);
            try {
              await grantFreeMonth(sub.user.id);
              await qc.invalidateQueries({ queryKey: ['admin-subscriptions'] });
              Alert.alert('Done', '1 free month granted.');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Failed.');
            } finally {
              setActioning(null);
            }
          },
        },
      ],
    );
  };

  const renderSub = ({ item }: { item: AdminSubscription }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{item.user.firstName} {item.user.lastName}</Text>
          <Text style={styles.meta}>{item.user.phone}</Text>
          {item.plan && <Text style={styles.meta}>Plan: {item.plan.name}</Text>}
          <Text style={styles.meta}>
            {item.status === 'TRIAL' ? `Trial ends: ${fmtDate(item.trialEndsAt)}` : `Renews: ${fmtDate(item.currentPeriodEnd)}`}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: (STATUS_COLOR[item.status] ?? Brand.muted) + '22' }]}>
          <Text style={[styles.pillText, { color: STATUS_COLOR[item.status] ?? Brand.muted }]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionBtn, styles.blueBtn, actioning === item.user.id && styles.btnDisabled]}
          onPress={() => handleExtendTrial(item)}
          disabled={actioning === item.user.id}
        >
          {actioning === item.user.id
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.actionBtnText}>Extend trial</Text>}
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.successBtn, actioning === item.user.id && styles.btnDisabled]}
          onPress={() => handleGrantMonth(item)}
          disabled={actioning === item.user.id}
        >
          <Text style={styles.actionBtnText}>+1 month</Text>
        </Pressable>
      </View>
    </View>
  );

  const total = subsQ.data?.total ?? 0;
  const totalPages = subsQ.data?.totalPages ?? 1;

  return (
    <View style={styles.flex}>
      {subsQ.isPending ? (
        <View style={styles.centered}><ActivityIndicator color={Brand.blue} /></View>
      ) : (
        <FlatList
          data={subsQ.data?.data ?? []}
          keyExtractor={(item: { id: string }) => item.id}
          renderItem={renderSub}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
          ListHeaderComponent={<Text style={styles.count}>{total} subscription{total !== 1 ? 's' : ''}</Text>}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pagination}>
                <Pressable style={[styles.pageBtn, page <= 1 && styles.btnDisabled]} onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <Text style={styles.pageBtnText}>← Prev</Text>
                </Pressable>
                <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
                <Pressable style={[styles.pageBtn, page >= totalPages && styles.btnDisabled]} onPress={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                  <Text style={styles.pageBtnText}>Next →</Text>
                </Pressable>
              </View>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>No subscriptions found.</Text>}
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

  card: {
    backgroundColor: Brand.card, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: Brand.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  userName: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  meta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  blueBtn: { backgroundColor: Brand.blue },
  successBtn: { backgroundColor: Brand.green },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },

  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  pageBtn: { backgroundColor: Brand.blue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  pageBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pageInfo: { fontSize: 13, color: Brand.muted, fontWeight: '700' },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },
});
