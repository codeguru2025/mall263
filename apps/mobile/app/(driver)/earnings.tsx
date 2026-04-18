import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { getDriverProfile, getMyJobs, type DeliveryJob } from '@/lib/delivery-api';

const TIER_COLOR: Record<string, string> = {
  ONBOARDING: Brand.muted,
  TRUSTED: Brand.blue,
  ELITE: Brand.orange,
};

const TIER_ICON: Record<string, string> = {
  ONBOARDING: '🔰',
  TRUSTED: '⭐',
  ELITE: '🏆',
};

const COMPLETED_STATUSES = ['COMPLETED', 'CANCELLED', 'RETURNED'];

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DriverEarningsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['driver-profile'],
    queryFn: getDriverProfile,
  });

  const jobsQuery = useQuery<DeliveryJob[]>({
    queryKey: ['my-jobs'],
    queryFn: getMyJobs,
  });

  const completedJobs = jobsQuery.data?.filter((j) => COMPLETED_STATUSES.includes(j.status)) ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([profileQuery.refetch(), jobsQuery.refetch()]);
    setRefreshing(false);
  }, [profileQuery, jobsQuery]);

  if (profileQuery.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  const profile = profileQuery.data;
  const tier = profile?.tier ?? 'ONBOARDING';

  const renderJob = useCallback(({ item }: { item: DeliveryJob }) => (
    <View style={styles.jobRow}>
      <View style={styles.jobLeft}>
        <Text style={styles.jobRoute}>{item.pickupZone} → {item.dropZone}</Text>
        <Text style={styles.jobDate}>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.jobEarning, item.status === 'COMPLETED' ? { color: Brand.green } : { color: Brand.muted }]}>
        {item.status === 'COMPLETED' ? `+$${Number(item.driverEarning).toFixed(2)}` : '—'}
      </Text>
    </View>
  ), []);

  return (
    <FlatList
      data={completedJobs}
      keyExtractor={(item: { id: string }) => item.id}
      renderItem={renderJob}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} />}
      ListHeaderComponent={
        <>
          {/* Tier badge */}
          <View style={[styles.tierBand, { backgroundColor: TIER_COLOR[tier] }]}>
            <Text style={styles.tierIcon}>{TIER_ICON[tier]}</Text>
            <View>
              <Text style={styles.tierLabel}>{tier} Driver</Text>
              <Text style={styles.tierSub}>
                COD limit: ${Number(profile?.maxCodExposure ?? 50).toFixed(0)} · Rating: {Number(profile?.rating ?? 50).toFixed(0)}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard
              label="Total Earnings"
              value={`$${Number(profile?.totalEarnings ?? 0).toFixed(2)}`}
              color={Brand.green}
            />
            <StatCard
              label="Completed Jobs"
              value={String(profile?.completedJobs ?? 0)}
            />
            <StatCard
              label="Float Balance"
              value={`$${Number(profile?.floatBalance ?? 0).toFixed(2)}`}
              color={Brand.blue}
            />
          </View>

          {profile && Number(profile.codCashHeld) > 0 && (
            <View style={styles.codAlert}>
              <Text style={styles.codAlertText}>
                ⚠ Cash held (COD): ${Number(profile.codCashHeld).toFixed(2)} — please remit to the platform soon.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Recent Jobs</Text>
        </>
      }
      ListEmptyComponent={<Text style={styles.empty}>No completed jobs yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tierBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  tierIcon: { fontSize: 36 },
  tierLabel: { color: '#fff', fontSize: 20, fontWeight: '900' },
  tierSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  statLabel: { fontSize: 11, color: Brand.muted, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  codAlert: { backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14, marginBottom: 16 },
  codAlertText: { color: Brand.orange, fontWeight: '700', fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', marginBottom: 10 },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  jobLeft: { flex: 1 },
  jobRoute: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  jobDate: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  jobEarning: { fontSize: 16, fontWeight: '900' },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 24 },
});
