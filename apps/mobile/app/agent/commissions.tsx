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
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { fetchMyTasks, type AgentTask } from '@/lib/agent-api';
import { fetchMeProfile } from '@/lib/me-profile';

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 }
    : { elevation: 2 };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtBalance(v: unknown, currency: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
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

  const tasksQ = useQuery({
    queryKey: ['agent-tasks', 'COMPLETED'],
    queryFn: () => fetchMyTasks('COMPLETED'),
  });

  const meQ = useQuery({
    queryKey: ['me-profile'],
    queryFn: fetchMeProfile,
  });

  const onboarded = (tasksQ.data ?? []).filter((t) => t.type === 'MERCHANT_ONBOARDING');
  const wallet = meQ.data?.wallet;
  const currency = wallet?.currency || 'USD';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([tasksQ.refetch(), meQ.refetch()]); } finally { setRefreshing(false); }
  }, [tasksQ, meQ]);

  const shareNudge = useCallback(async (task: AgentTask) => {
    const first = merchantName(task).split(' ')[0];
    await Share.share({
      message:
        `Hi ${first}! 👋\n\nYour Mall263 merchant account is set up and ready.\n\n` +
        `To unlock full visibility, POS register, and all platform features, ` +
        `upgrade to a premium subscription:\n\nhttps://mall263.com/subscriptions\n\n` +
        `Once subscribed, your store goes live to all buyers on the platform. ` +
        `Let me know if you need any help getting started!`,
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

      <View style={styles.commissionNote}>
        <FontAwesome name="info-circle" size={12} color={Brand.orange} />
        <Text style={styles.commissionNoteText}>
          Commission is credited to your wallet when {merchantName(item).split(' ')[0]} subscribes to a paid plan.
        </Text>
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
        <Text style={styles.heroTitle}>Commissions</Text>
        <Text style={styles.heroSub}>
          Register merchants and push them to subscribe — your commission lands in your wallet automatically when they pay.
        </Text>
      </View>

      {/* Wallet snapshot */}
      <Pressable style={[styles.walletCard, cardShadow]} onPress={() => router.push('/(tabs)/wallet')}>
        <View style={styles.walletLeft}>
          <Text style={styles.walletLabel}>Your wallet balance</Text>
          <Text style={styles.walletAmount}>
            {meQ.isPending ? '…' : fmtBalance(wallet?.availableBalance, currency)}
          </Text>
          {wallet?.lockedBalance !== undefined && Number(wallet.lockedBalance) > 0 && (
            <Text style={styles.walletLocked}>
              + {fmtBalance(wallet.lockedBalance, currency)} locked
            </Text>
          )}
        </View>
        <View style={styles.walletRight}>
          <Text style={styles.walletCta}>View wallet</Text>
          <FontAwesome name="chevron-right" size={12} color={Brand.blue} />
        </View>
      </Pressable>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, cardShadow]}>
          <Text style={styles.summaryValue}>{onboarded.length}</Text>
          <Text style={styles.summaryLabel}>Merchants recruited</Text>
        </View>
        <Pressable
          style={[styles.summaryCard, cardShadow, styles.recruitCard]}
          onPress={() => router.push('/agent/recruit' as any)}
        >
          <FontAwesome name="user-plus" size={20} color="#7C3AED" />
          <Text style={[styles.summaryLabel, { color: '#7C3AED', marginTop: 4 }]}>Recruit new</Text>
        </Pressable>
      </View>

      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How commissions work</Text>
        {[
          { icon: 'user-plus', text: 'You recruit a merchant and register their account' },
          { icon: 'shopping-bag', text: 'You help them set up their stall and capture products' },
          { icon: 'share-alt', text: 'You nudge them to subscribe to a paid plan' },
          { icon: 'money', text: 'When they pay, your commission is credited to your wallet' },
        ].map((step, i) => (
          <View key={i} style={styles.howStep}>
            <View style={styles.howIcon}>
              <FontAwesome name={step.icon as any} size={13} color={Brand.green} />
            </View>
            <Text style={styles.howText}>{step.text}</Text>
          </View>
        ))}
        <Text style={styles.rateNote}>
          Commission rates are confirmed by your Mall263 supervisor. Contact them for your specific rate.
        </Text>
      </View>

      {onboarded.length > 0 && (
        <Text style={styles.listLabel}>Your merchant pipeline ({onboarded.length})</Text>
      )}
    </>
  );

  if (tasksQ.isPending) {
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
              Recruit a merchant above to start earning commissions when they subscribe.
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
  listContent: { padding: 16, paddingBottom: 40, gap: 12 },

  hero: {
    backgroundColor: Brand.green,
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19 },

  walletCard: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletLeft: { flex: 1 },
  walletLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  walletAmount: { fontSize: 26, fontWeight: '900', color: Brand.navy, marginTop: 4 },
  walletLocked: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  walletRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletCta: { fontSize: 13, fontWeight: '700', color: Brand.blue },

  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  recruitCard: { alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 28, fontWeight: '900', color: Brand.navy },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, marginTop: 2 },

  howCard: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 10,
  },
  howTitle: { fontSize: 13, fontWeight: '800', color: Brand.navy, marginBottom: 2 },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  howIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    flexShrink: 0,
  },
  howText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 20 },
  rateNote: { fontSize: 12, color: Brand.muted, lineHeight: 17, marginTop: 4, fontStyle: 'italic' },

  listLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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

  commissionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  commissionNoteText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 17 },

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

  empty: { paddingTop: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  emptyBody: { fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
});
