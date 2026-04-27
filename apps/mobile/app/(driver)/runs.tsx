import { useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Platform, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { runsApi, type Run } from '@/lib/runs-api';
import { formatMoney } from '@/lib/products';

export default function DriverRunsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const q = useQuery({
    queryKey: ['driver-open-runs'],
    queryFn: runsApi.getOpenRuns,
    refetchInterval: 15_000,
  });

  const activeQ = useQuery({
    queryKey: ['driver-active-run'],
    queryFn: runsApi.getDriverActiveRun,
    refetchInterval: 15_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([q.refetch(), activeQ.refetch()]);
    setRefreshing(false);
  };

  if (q.isPending && !q.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.primary} />
        <Text style={styles.muted}>Loading runs…</Text>
      </View>
    );
  }

  const runs = q.data ?? [];
  const activeRun = activeQ.data ?? null;

  const activeRunBanner = activeRun ? (
    <Pressable
      style={styles.activeRunBanner}
      onPress={() => router.push('/(driver)/active-run' as never)}
    >
      <View style={styles.activeRunDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.activeRunTitle}>You have an active run</Text>
        <Text style={styles.activeRunSub}>
          {activeRun.status === 'LOCKED' ? `${activeRun.stops.filter((s) => s.status === 'PENDING').length} stop(s) to collect` :
           activeRun.status === 'IN_PROGRESS' ? 'All items collected — deliver now' :
           'Waiting for buyer confirmation'}
        </Text>
      </View>
      <FontAwesome name="chevron-right" size={12} color={Brand.primary} />
    </Pressable>
  ) : null;

  return (
    <FlatList
      data={runs}
      keyExtractor={(item: Run) => item.id}
      renderItem={({ item }: { item: Run }) => <RunCard run={item} qc={qc} router={router} />}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          {activeRunBanner}
          <Text style={styles.heading}>Open Runs ({runs.length})</Text>
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <FontAwesome name="truck" size={40} color={Brand.border} />
          <Text style={styles.emptyTitle}>No open runs</Text>
          <Text style={styles.muted}>Check back soon — buyers post multi-shop runs here.</Text>
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
    />
  );
}

function RunCard({ run, qc, router }: { run: Run; qc: ReturnType<typeof useQueryClient>; router: ReturnType<typeof useRouter> }) {
  const [bidFee, setBidFee] = useState('');
  const [bidMsg, setBidMsg] = useState('');
  const [showBid, setShowBid] = useState(false);

  const myBid = run.bids?.[0];

  const placeBid = useMutation({
    mutationFn: () => runsApi.placeBid(run.id, parseFloat(bidFee), bidMsg || undefined),
    onSuccess: () => {
      setBidFee('');
      setBidMsg('');
      setShowBid(false);
      qc.invalidateQueries({ queryKey: ['driver-open-runs'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not place bid'),
  });

  const withdrawBid = useMutation({
    mutationFn: () => runsApi.withdrawBid(run.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-open-runs'] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not withdraw'),
  });

  const totalItems = run.stops.reduce((n, s) => n + s.items.reduce((nn, i) => nn + i.quantity, 0), 0);
  const totalValue = run.stops.reduce((n, s) => n + parseFloat(s.itemAmount ?? '0'), 0);

  return (
    <View style={styles.card}>
      {/* Route summary */}
      <View style={styles.routeRow}>
        {run.stops.sort((a, b) => a.stopOrder - b.stopOrder).map((stop, i) => (
          <View key={stop.id} style={styles.routeStop}>
            <View style={styles.stopDot} />
            <Text style={styles.routeStopName} numberOfLines={1}>{stop.stall.name}</Text>
          </View>
        ))}
        <View style={styles.routeStop}>
          <FontAwesome name="flag-checkered" size={12} color={Brand.green} />
          <Text style={styles.routeStopName} numberOfLines={1}>{run.dropZone}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{run.stops.length}</Text>
          <Text style={styles.statLabel}>Stops</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalItems}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{run.totalDistanceKm ? `${parseFloat(run.totalDistanceKm ?? '0').toFixed(1)} km` : '—'}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: Brand.primary }]}>
            {run.suggestedFee ? formatMoney(parseFloat(run.suggestedFee ?? '0'), 'USD') : '—'}
          </Text>
          <Text style={styles.statLabel}>Suggested</Text>
        </View>
      </View>

      {/* Items preview */}
      <View style={styles.itemsPreview}>
        {run.stops.slice(0, 2).flatMap((s) => s.items.slice(0, 2)).map((item) => (
          <Text key={item.id} style={styles.itemPreviewText} numberOfLines={1}>
            • {item.variant.product.name} — {item.variant.name} ×{item.quantity}
          </Text>
        ))}
        {totalItems > 4 && <Text style={styles.moreItems}>+ more items…</Text>}
      </View>

      {/* Competitor bids count */}
      <Text style={styles.bidsCount}>
        {(run as any)._count?.bids ?? 0} bid(s) so far
      </Text>

      {/* My existing bid */}
      {myBid && myBid.status === 'PENDING' && (
        <View style={styles.myBidRow}>
          <Text style={styles.myBidText}>Your bid: <Text style={styles.myBidFee}>{formatMoney(parseFloat(myBid.fee), 'USD')}</Text></Text>
          <Pressable
            style={styles.withdrawBtn}
            onPress={() => withdrawBid.mutate()}
            disabled={withdrawBid.isPending}
          >
            <Text style={styles.withdrawBtnText}>{withdrawBid.isPending ? 'Withdrawing…' : 'Withdraw'}</Text>
          </Pressable>
        </View>
      )}

      {/* Bid form */}
      {!myBid || myBid.status !== 'PENDING' ? (
        showBid ? (
          <View style={styles.bidForm}>
            <TextInput
              style={styles.bidInput}
              value={bidFee}
              onChangeText={setBidFee}
              placeholder="Your fee in USD"
              keyboardType="decimal-pad"
              placeholderTextColor={Brand.muted}
            />
            <TextInput
              style={[styles.bidInput, { marginTop: 6 }]}
              value={bidMsg}
              onChangeText={setBidMsg}
              placeholder="Optional message to buyer"
              placeholderTextColor={Brand.muted}
            />
            <View style={styles.bidFormBtns}>
              <Pressable style={styles.cancelBidBtn} onPress={() => setShowBid(false)}>
                <Text style={styles.cancelBidBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBidBtn, (placeBid.isPending || !bidFee) && { opacity: 0.6 }]}
                disabled={placeBid.isPending || !bidFee}
                onPress={() => placeBid.mutate()}
              >
                {placeBid.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.submitBidBtnText}>Submit bid</Text>
                }
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.bidBtn} onPress={() => setShowBid(true)}>
            <FontAwesome name="gavel" size={14} color="#fff" />
            <Text style={styles.bidBtnText}>Place bid</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { color: Brand.muted, fontSize: 13, marginTop: 8, textAlign: 'center' },
  list: { padding: 14, paddingBottom: 32 },
  heading: { fontSize: 18, fontWeight: '900', color: Brand.navy, marginBottom: 12 },

  activeRunBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Brand.primary + '12', borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1.5, borderColor: Brand.primary + '40',
  },
  activeRunDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Brand.primary },
  activeRunTitle: { fontSize: 14, fontWeight: '800', color: Brand.navy },
  activeRunSub: { fontSize: 12, color: Brand.muted, marginTop: 1 },
  empty: { alignItems: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy },

  card: {
    backgroundColor: Brand.card, borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: Brand.border, ...cardShadow,
  },

  routeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  routeStop: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.pageBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: Brand.border },
  stopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.primary },
  routeStopName: { fontSize: 11, fontWeight: '700', color: Brand.navy, maxWidth: 80 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: Brand.pageBg, borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: Brand.border },
  statValue: { fontSize: 15, fontWeight: '900', color: Brand.navy },
  statLabel: { fontSize: 10, color: Brand.muted, marginTop: 2 },

  itemsPreview: { marginBottom: 8 },
  itemPreviewText: { fontSize: 12, color: '#475569', marginBottom: 2 },
  moreItems: { fontSize: 11, color: Brand.muted },
  bidsCount: { fontSize: 11, color: Brand.muted, fontWeight: '600', marginBottom: 10 },

  myBidRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Brand.primary + '10', borderRadius: 10, padding: 10, marginBottom: 8 },
  myBidText: { fontSize: 13, color: Brand.navy, fontWeight: '600' },
  myBidFee: { color: Brand.primary, fontWeight: '900' },
  withdrawBtn: { borderWidth: 1, borderColor: Brand.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  withdrawBtnText: { color: Brand.red, fontWeight: '700', fontSize: 12 },

  bidBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primary, paddingVertical: 11, borderRadius: 10 },
  bidBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  bidForm: { borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 12, marginTop: 4 },
  bidInput: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.navy, backgroundColor: Brand.pageBg },
  bidFormBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cancelBidBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Brand.border },
  cancelBidBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 13 },
  submitBidBtn: { flex: 2, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: Brand.primary },
  submitBidBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
