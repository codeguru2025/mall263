import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { confirmCodCollected, fetchCodLiability, remitCodCash } from '@/lib/delivery-api';
import { Brand } from '@/constants/brand';

function formatMoney(value: unknown, currency = 'USD') {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

export default function DriverCodScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const q = useQuery({
    queryKey: ['driver-cod-liability'],
    queryFn: fetchCodLiability,
    refetchInterval: 30000,
  });

  const remitMut = useMutation({
    mutationFn: (jobId: string) => remitCodCash(jobId, 'ECOCASH'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-cod-liability'] });
      Alert.alert('Remittance recorded', 'Thanks! Cash has been logged as remitted.');
    },
    onError: (err) => Alert.alert('Error', extractErr(err, 'Could not remit cash.')),
  });

  const confirmMut = useMutation({
    mutationFn: (jobId: string) => confirmCodCollected(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-cod-liability'] });
    },
    onError: (err) => Alert.alert('Error', extractErr(err, 'Could not confirm collection.')),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const held = q.data?.codCashHeld ?? 0;
  const max = q.data?.maxCodExposure ?? 0;
  const pending = q.data?.pendingRemits ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={pending}
        keyExtractor={(p: { jobId: string }) => p.jobId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Cash held (COD)</Text>
              <Text style={styles.summaryAmount}>{formatMoney(held)}</Text>
              <View style={styles.limitRow}>
                <FontAwesome name="shield" size={11} color="#ffffffcc" />
                <Text style={styles.limitText}>Limit: {formatMoney(max)}</Text>
              </View>
              {q.data?.overdueCount ? (
                <View style={styles.overdueBadge}>
                  <FontAwesome name="exclamation-triangle" size={11} color="#b91c1c" />
                  <Text style={styles.overdueText}>{q.data.overdueCount} overdue remit(s)</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.sectionTitle}>Pending remits</Text>
          </>
        }
        renderItem={({ item }: { item: { jobId: string; amount: number | string; createdAt: string; trackingNumber?: string | null } }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowAmount}>{formatMoney(item.amount)}</Text>
              <Text style={styles.rowMeta}>
                {item.trackingNumber ? `Job ${item.trackingNumber}` : item.jobId.slice(0, 8)}
                {' · '}
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                style={[styles.confirmBtn, confirmMut.isPending && styles.btnDisabled]}
                onPress={() => confirmMut.mutate(item.jobId)}
                disabled={confirmMut.isPending}
              >
                <Text style={styles.confirmBtnText}>Collected</Text>
              </Pressable>
              <Pressable
                style={[styles.remitBtn, remitMut.isPending && styles.btnDisabled]}
                onPress={() => remitMut.mutate(item.jobId)}
                disabled={remitMut.isPending}
              >
                <Text style={styles.remitBtnText}>Remit</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator color={Brand.blue} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.emptyBox}>
              <FontAwesome name="check-circle" size={30} color="#16a34a" />
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptySub}>
                You have no pending remits. Keep collecting cash on delivery jobs and come back here to
                record them.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function extractErr(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { message?: string | string[] } | undefined;
    const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
    if (m) return m;
  }
  return fallback;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  listContent: { padding: 14, paddingBottom: 40 },

  summaryCard: {
    backgroundColor: Brand.navy,
    padding: 20,
    borderRadius: 18,
    marginBottom: 16,
  },
  summaryLabel: {
    color: '#ffffff99',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryAmount: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: 6, letterSpacing: -0.6 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  limitText: { color: '#ffffffcc', fontSize: 12, fontWeight: '700' },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  overdueText: { color: '#b91c1c', fontSize: 11, fontWeight: '800' },

  sectionTitle: { fontSize: 13, fontWeight: '900', color: Brand.navy, marginBottom: 8, marginLeft: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 10,
    gap: 10,
  },
  rowAmount: { fontSize: 16, fontWeight: '900', color: Brand.navy },
  rowMeta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 6 },
  confirmBtn: {
    backgroundColor: '#eff6fc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  confirmBtnText: { color: Brand.blue, fontWeight: '800', fontSize: 12 },
  remitBtn: { backgroundColor: Brand.blue, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  remitBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  btnDisabled: { opacity: 0.55 },

  emptyBox: {
    alignItems: 'center',
    padding: 26,
    borderRadius: 14,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    marginTop: 4,
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  emptySub: { fontSize: 12, color: Brand.muted, textAlign: 'center' },
});
