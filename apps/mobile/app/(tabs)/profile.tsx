import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';
import { fetchMeProfile, patchMeProfile, type MeProfile } from '@/lib/me-profile';

function fmtBalance(v: unknown, currency: string): string {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (Number.isFinite(n)) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  }
  return String(v);
}

export default function ProfileScreen() {
  const { reloadUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const q = useQuery({
    queryKey: ['me-profile'],
    queryFn: fetchMeProfile,
  });

  useEffect(() => {
    if (q.data) {
      setFirstName(q.data.firstName || '');
      setLastName(q.data.lastName || '');
    }
  }, [q.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      patchMeProfile({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim(),
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['me-profile'], (prev) =>
        prev ? ({ ...prev, ...updated } as MeProfile) : (updated as MeProfile),
      );
      await reloadUser();
      Alert.alert('Saved', 'Your profile was updated.');
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Could not save.';
      Alert.alert('Save failed', typeof msg === 'string' ? msg : 'Try again.');
    },
  });

  const onSave = useCallback(() => {
    if (!firstName.trim()) {
      Alert.alert('Missing name', 'First name cannot be empty.');
      return;
    }
    saveMutation.mutate();
  }, [firstName, lastName, saveMutation]);

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading profile…</Text>
      </View>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Could not load profile.</Text>
        <Pressable style={styles.retry} onPress={() => q.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ProfileBody data={q.data} firstName={firstName} lastName={lastName} setFirstName={setFirstName} setLastName={setLastName} />
        <Pressable
          style={[styles.primaryBtn, saveMutation.isPending && styles.btnDisabled]}
          onPress={onSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Save changes</Text>
          )}
        </Pressable>
        {['SUPER_ADMIN', 'ADMIN_OPS', 'FINANCE_ADMIN', 'SUPPORT_ADMIN'].includes(q.data?.role ?? '') && (
          <Pressable style={styles.adminBtn} onPress={() => router.push('/admin')}>
            <Text style={styles.adminBtnText}>⚙️  Admin Panel</Text>
          </Pressable>
        )}
        {q.data?.role === 'FIELD_AGENT' && (
          <Pressable style={styles.agentBtn} onPress={() => router.push('/agent')}>
            <Text style={styles.agentBtnText}>🗂  Field Agent</Text>
          </Pressable>
        )}
        {q.data?.role === 'DRIVER' && (
          <>
            <Pressable style={styles.driverBtn} onPress={() => router.push('/(driver)/jobs')}>
              <Text style={styles.driverBtnText}>🚗  Driver Hub</Text>
            </Pressable>
            <Pressable style={styles.outlineBtn} onPress={() => router.push('/driver/cod')}>
              <Text style={styles.outlineBtnText}>💵  Cash on Delivery</Text>
            </Pressable>
          </>
        )}
        {(q.data?.merchant || (q.data?.attendantStall ?? []).length > 0) && (
          <Pressable style={styles.posBtn} onPress={() => router.push('/pos')}>
            <Text style={styles.posBtnText}>🧾  POS Register</Text>
          </Pressable>
        )}
        {q.data?.merchant && (
          <Pressable style={styles.sellerBtn} onPress={() => router.push('/seller')}>
            <Text style={styles.sellerBtnText}>🏪  Seller Hub</Text>
          </Pressable>
        )}

        <View style={styles.linksCard}>
          <Pressable style={styles.linkRow} onPress={() => router.push('/malls')}>
            <Text style={styles.linkText}>🏬  Browse malls</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/services')}>
            <Text style={styles.linkText}>🛠  Services marketplace</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/subscriptions')}>
            <Text style={styles.linkText}>⭐  Subscription</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/disputes')}>
            <Text style={styles.linkText}>⚖️  My disputes</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/support')}>
            <Text style={styles.linkText}>💬  Help &amp; support</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/help/faq')}>
            <Text style={styles.linkText}>❓  FAQ</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => router.push('/help/terms')}>
            <Text style={styles.linkText}>📄  Terms of service</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Pressable>
          {q.data?.role !== 'DRIVER' && (
            <Pressable style={[styles.linkRow, styles.linkRowLast]} onPress={() => router.push('/driver/register')}>
              <Text style={styles.linkText}>🚗  Become a driver</Text>
              <Text style={styles.linkChevron}>›</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.outlineBtn} onPress={() => logout()}>
          <Text style={styles.outlineBtnText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfileBody({
  data,
  firstName,
  lastName,
  setFirstName,
  setLastName,
}: {
  data: MeProfile;
  firstName: string;
  lastName: string;
  setFirstName: (s: string) => void;
  setLastName: (s: string) => void;
}) {
  const w = data.wallet;
  const currency = w?.currency || 'USD';

  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Profile</Text>
        <Text style={styles.heroSub}>Account & wallet summary</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Phone</Text>
        <Text style={styles.readonly}>{data.phone}</Text>
        <Text style={styles.hintSmall}>Phone cannot be changed in the app yet.</Text>

        <Text style={[styles.sectionLabel, styles.mt]}>Role & status</Text>
        <View style={styles.rowInline}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{data.role.replace(/_/g, ' ')}</Text>
          </View>
          <Text style={styles.statusText}>{data.status.replace(/_/g, ' ')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Your name</Text>
        <Text style={styles.fieldLabel}>First name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={Brand.muted}
        />
        <Text style={styles.fieldLabel}>Last name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={Brand.muted}
        />
      </View>

      {w ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Wallet</Text>
          <View style={styles.walletRow}>
            <Text style={styles.walletLabel}>Available</Text>
            <Text style={styles.walletValue}>{fmtBalance(w.availableBalance, currency)}</Text>
          </View>
          <View style={styles.walletRow}>
            <Text style={styles.walletLabel}>Locked</Text>
            <Text style={styles.walletValue}>{fmtBalance(w.lockedBalance, currency)}</Text>
          </View>
        </View>
      ) : null}

      {data.trustScore != null ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Trust score</Text>
          <Text style={styles.trustBig}>{String(data.trustScore.overallScore ?? '—')}</Text>
          <Text style={styles.hintSmall}>Same signal buyers and sellers see on the web.</Text>
        </View>
      ) : null}

      {data.merchant ? (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Business</Text>
          <Text style={styles.bizName}>{data.merchant.businessName}</Text>
          <Text style={styles.hintSmall}>Merchant status: {data.merchant.status}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted },
  error: { color: Brand.red, fontWeight: '700' },
  retry: { marginTop: 16, backgroundColor: Brand.blue, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  hero: {
    backgroundColor: Brand.navy,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  readonly: { fontSize: 17, fontWeight: '700', color: Brand.navy },
  hintSmall: { fontSize: 12, color: Brand.muted, marginTop: 6 },
  mt: { marginTop: 14 },
  rowInline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  pill: {
    backgroundColor: Brand.pageBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  pillText: { fontSize: 12, fontWeight: '700', color: Brand.blue, textTransform: 'capitalize' },
  statusText: { fontSize: 13, color: Brand.muted, textTransform: 'capitalize' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Brand.navy, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: Brand.text,
    marginBottom: 12,
    backgroundColor: Brand.pageBg,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  walletLabel: { fontSize: 15, color: Brand.muted },
  walletValue: { fontSize: 15, fontWeight: '700', color: Brand.navy },
  trustBig: { fontSize: 36, fontWeight: '900', color: Brand.blue },
  bizName: { fontSize: 18, fontWeight: '800', color: Brand.navy },
  primaryBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  outlineBtn: {
    borderWidth: 2,
    borderColor: Brand.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Brand.card,
    marginTop: 14,
  },
  outlineBtnText: { fontSize: 15, fontWeight: '700', color: Brand.navy },
  adminBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  adminBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  agentBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  agentBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  posBtn: {
    backgroundColor: Brand.green,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  posBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  sellerBtn: {
    backgroundColor: Brand.navy,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  sellerBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  driverBtn: {
    backgroundColor: '#0f766e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  driverBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  linksCard: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    marginTop: 14,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  linkRowLast: { borderBottomWidth: 0 },
  linkText: { fontSize: 15, fontWeight: '600', color: Brand.navy },
  linkChevron: { fontSize: 22, color: Brand.muted, fontWeight: '300' },
});
