import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { fetchMyTasks, type AgentTask } from '@/lib/agent-api';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function merchantName(task: AgentTask): string {
  const d = task.data;
  const biz = d.businessName ? String(d.businessName) : '';
  const first = d.newUserFirstName ? String(d.newUserFirstName) : '';
  const last = d.newUserLastName ? String(d.newUserLastName) : '';
  return biz || [first, last].filter(Boolean).join(' ') || 'Unknown merchant';
}

function merchantPhone(task: AgentTask): string {
  const d = task.data;
  return String(d.businessPhone ?? d.newUserPhone ?? '');
}

export default function CommissionsScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const q = useQuery({
    queryKey: ['agent-tasks', 'COMPLETED'],
    queryFn: () => fetchMyTasks('COMPLETED'),
  });

  const onboarded = (q.data ?? []).filter((t) => t.type === 'MERCHANT_ONBOARDING');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await q.refetch(); } finally { setRefreshing(false); }
  }, [q]);

  const shareNudge = useCallback(async (task: AgentTask) => {
    const name = merchantName(task).split(' ')[0];
    await Share.share({
      message: `Hi ${name}! 👋\n\nYour Mall263 merchant account is ready. Upgrade to a premium subscription to unlock full store visibility, POS, and more:\n\nhttps://mall263.com/subscriptions\n\nAny questions, reach out to me directly.`,
    });
  }, []);

  const renderItem = useCallback(({ item }: { item: AgentTask }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{merchantName(item).charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardText}>
          <Text style={styles.merchantName} numberOfLines={1}>{merchantName(item)}</Text>
          <Text style={styles.merchantPhone}>{merchantPhone(item)}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Onboarded</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <FontAwesome name="calendar" size={11} color={Brand.muted} />
        <Text style={styles.metaText}>Completed {fmtDate(item.completedAt ?? item.createdAt)}</Text>
      </View>
      <Pressable
        style={styles.nudgeBtn}
        onPress={() => shareNudge(item)}
        android_ripple={{ color: Brand.border }}
      >
        <FontAwesome name="share-alt" size={13} color={Brand.blue} />
        <Text style={styles.nudgeBtnText}>Send subscription nudge</Text>
      </Pressable>
    </View>
  ), [shareNudge]);

  const header = (
    <>
      <View style={styles.hero}>
        <FontAwesome name="money" size={28} color="#fff" />
        <Text style={styles.heroTitle}>My commissions</Text>
        <Text style={styles.heroSub}>
          You earn a commission each time a merchant you recruited upgrades to a paid subscription.
        </Text>
      </View>

      <View style={[styles.summaryRow]}>
        <View style={[styles.summaryCard, cardShadow]}>
          <Text style={styles.summaryValue}>{onboarded.length}</Text>
          <Text style={styles.summaryLabel}>Merchants recruited</Text>
        </View>
        <View style={[styles.summaryCard, cardShadow, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Text style={[styles.summaryValue, { color: Brand.green }]}>%</Text>
          <Text style={styles.summaryLabel}>Commission on subscriptions</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <FontAwesome name="info-circle" size={14} color={Brand.blue} />
        <Text style={styles.infoText}>
          Commission rates are set by the Mall263 team and credited to your wallet when a recruited merchant pays their first subscription invoice. Contact your supervisor for your current rate.
        </Text>
      </View>

      {onboarded.length > 0 && (
        <Text style={styles.listLabel}>Recruited merchants ({onboarded.length})</Text>
      )}
    </>
  );

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={onboarded}
        keyExtractor={(i: AgentTask) => i.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} colors={[Brand.blue]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome name="users" size={40} color={Brand.muted} />
            <Text style={styles.emptyTitle}>No recruits yet</Text>
            <Text style={styles.emptyBody}>
              Complete merchant onboarding tasks to see them here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.pageBg },
  listContent: { padding: 16, paddingBottom: 40, gap: 10 },

  hero: {
    backgroundColor: Brand.green,
    borderRadius: 18,
    padding: 20,
    gap: 10,
    marginBottom: 4,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },

  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  summaryValue: { fontSize: 28, fontWeight: '900', color: Brand.navy },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 2 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6fc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: { flex: 1, fontSize: 13, color: Brand.blue, lineHeight: 19 },

  listLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Brand.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  avatarLetter: { fontSize: 20, fontWeight: '900', color: Brand.blue },
  cardText: { flex: 1 },
  merchantName: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  merchantPhone: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  badge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: Brand.green },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: Brand.muted },
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.pageBg,
  },
  nudgeBtnText: { fontSize: 13, fontWeight: '700', color: Brand.blue },

  empty: { paddingTop: 40, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  emptyBody: { fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20 },
});
