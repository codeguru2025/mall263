import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS'];

type PromoType = 'REFERRAL' | 'COUPON' | 'DISCOUNT';

type Promotion = {
  id: string;
  code: string;
  type: PromoType;
  discountPct: string | null;
  discountAmt: string | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  description: string | null;
};

const TYPE_COLOR: Record<PromoType, string> = {
  REFERRAL: '#7C3AED',
  COUPON: Brand.primary,
  DISCOUNT: Brand.orange,
};

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

const TODAY = new Date().toISOString().slice(0, 10);

const BLANK = { code: '', type: 'COUPON' as PromoType, discountType: 'pct' as 'pct' | 'amt', discountValue: '', maxUses: '', validFrom: TODAY, validUntil: '', description: '' };

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' }); }
  catch { return iso; }
}

export default function AdminPromotionsScreen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.replace('/admin');
  }, [isAuthenticated, user]);

  const promosQ = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: () => api.get<Promotion[]>('/api/v1/admin/promotions').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await promosQ.refetch(); } finally { setRefreshing(false); }
  }, [promosQ]);

  const togglePromo = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/admin/promotions/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-promotions'] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  const deletePromo = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/promotions/${id}`).then((r) => r.data),
    onSuccess: () => { Alert.alert('Deleted', 'Promo code deleted.'); qc.invalidateQueries({ queryKey: ['admin-promotions'] }); },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  const createPromo = useMutation({
    mutationFn: (body: object) => api.post('/api/v1/admin/promotions', body).then((r) => r.data),
    onSuccess: () => {
      Alert.alert('Created', 'Promo code created.');
      setShowForm(false);
      setForm(BLANK);
      qc.invalidateQueries({ queryKey: ['admin-promotions'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  function handleCreate() {
    if (!form.code.trim()) { Alert.alert('Validation', 'Code is required'); return; }
    if (!form.discountValue) { Alert.alert('Validation', 'Enter a discount value'); return; }
    createPromo.mutate({
      code: form.code.trim().toUpperCase(),
      type: form.type,
      discountPct: form.discountType === 'pct' ? parseFloat(form.discountValue) : undefined,
      discountAmt: form.discountType === 'amt' ? parseFloat(form.discountValue) : undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      validFrom: form.validFrom || TODAY,
      validUntil: form.validUntil || undefined,
      description: form.description || undefined,
    });
  }

  function confirmDelete(p: Promotion) {
    Alert.alert('Delete promo?', `${p.code} — this cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePromo.mutate(p.id) },
    ]);
  }

  const renderPromo = ({ item }: { item: Promotion }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.meta}>
            {item.type} · {item.discountPct ? `${item.discountPct}% off` : item.discountAmt ? `$${item.discountAmt} off` : '—'}
          </Text>
          <Text style={styles.meta}>
            Used {item.usedCount}/{item.maxUses ?? '∞'} · {fmtDate(item.validFrom)} – {fmtDate(item.validUntil)}
          </Text>
          {item.description && <Text style={styles.metaDesc}>{item.description}</Text>}
        </View>
        <View style={styles.rightCol}>
          <View style={[styles.pill, { backgroundColor: (TYPE_COLOR[item.type] ?? Brand.muted) + '22' }]}>
            <Text style={[styles.pillText, { color: TYPE_COLOR[item.type] ?? Brand.muted }]}>{item.type}</Text>
          </View>
          <Switch
            value={item.isActive}
            onValueChange={(v: boolean) => togglePromo.mutate({ id: item.id, isActive: v })}
            trackColor={{ false: Brand.border, true: Brand.primary + '88' }}
            thumbColor={item.isActive ? Brand.primary : '#ccc'}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
      <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
        <Text style={styles.deleteBtnText}>Delete</Text>
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
        {/* Create form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New Promo Code</Text>

            <Text style={styles.fieldLabel}>Code *</Text>
            <TextInput style={styles.input} value={form.code} onChangeText={(v: string) => setForm((f) => ({ ...f, code: v.toUpperCase() }))} placeholder="SUMMER20" placeholderTextColor={Brand.muted} autoCapitalize="characters" />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(['COUPON', 'DISCOUNT', 'REFERRAL'] as PromoType[]).map((t) => (
                <Pressable key={t} style={[styles.typeChip, form.type === t && styles.typeChipActive]} onPress={() => setForm((f) => ({ ...f, type: t }))}>
                  <Text style={[styles.typeChipText, form.type === t && styles.typeChipTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Discount Type</Text>
            <View style={styles.typeRow}>
              {[{ k: 'pct', l: 'Percent (%)' }, { k: 'amt', l: 'Fixed ($)' }].map(({ k, l }) => (
                <Pressable key={k} style={[styles.typeChip, form.discountType === k && styles.typeChipActive]} onPress={() => setForm((f) => ({ ...f, discountType: k as 'pct' | 'amt' }))}>
                  <Text style={[styles.typeChipText, form.discountType === k && styles.typeChipTextActive]}>{l}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Discount Value *</Text>
            <TextInput style={styles.input} value={form.discountValue} onChangeText={(v: string) => setForm((f) => ({ ...f, discountValue: v }))} keyboardType="decimal-pad" placeholder="10" placeholderTextColor={Brand.muted} />

            <Text style={styles.fieldLabel}>Max Uses (blank = unlimited)</Text>
            <TextInput style={styles.input} value={form.maxUses} onChangeText={(v: string) => setForm((f) => ({ ...f, maxUses: v }))} keyboardType="number-pad" placeholder="100" placeholderTextColor={Brand.muted} />

            <Text style={styles.fieldLabel}>Valid From (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.validFrom} onChangeText={(v: string) => setForm((f) => ({ ...f, validFrom: v }))} placeholder={TODAY} placeholderTextColor={Brand.muted} />

            <Text style={styles.fieldLabel}>Valid Until (blank = no expiry)</Text>
            <TextInput style={styles.input} value={form.validUntil} onChangeText={(v: string) => setForm((f) => ({ ...f, validUntil: v }))} placeholder="2026-12-31" placeholderTextColor={Brand.muted} />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={form.description} onChangeText={(v: string) => setForm((f) => ({ ...f, description: v }))} placeholder="Optional description" placeholderTextColor={Brand.muted} multiline />

            <View style={styles.formActions}>
              <Pressable style={[styles.btn, styles.cancelBtn]} onPress={() => { setShowForm(false); setForm(BLANK); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.primaryBtn, createPromo.isPending && styles.btnDisabled]} onPress={handleCreate} disabled={createPromo.isPending}>
                {createPromo.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Create</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {!showForm && (
          <View style={styles.topBar}>
            <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.addBtnText}>+ New Code</Text>
            </Pressable>
          </View>
        )}

        {promosQ.isPending ? (
          <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={promosQ.data ?? []}
            keyExtractor={(item: Promotion) => item.id}
            renderItem={renderPromo}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
            ListHeaderComponent={<Text style={styles.count}>{promosQ.data?.length ?? 0} code{promosQ.data?.length !== 1 ? 's' : ''}</Text>}
            ListEmptyComponent={<Text style={styles.empty}>No promo codes yet.</Text>}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  topBar: { padding: 12, backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border },
  addBtn: { backgroundColor: Brand.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  formCard: {
    backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border,
    padding: 16,
  },
  formTitle: { fontSize: 16, fontWeight: '900', color: Brand.navy, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.text, backgroundColor: Brand.pageBg },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  typeChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Brand.pageBg, borderWidth: 1, borderColor: Brand.border },
  typeChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
  typeChipTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  primaryBtn: { backgroundColor: Brand.primary },
  cancelBtn: { backgroundColor: Brand.pageBg, borderWidth: 1, borderColor: Brand.border },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 14 },

  list: { padding: 12, paddingBottom: 40 },
  count: { fontSize: 12, color: Brand.muted, marginBottom: 8 },
  card: { backgroundColor: Brand.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Brand.border },
  cardTop: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  code: { fontSize: 16, fontWeight: '900', color: Brand.navy, letterSpacing: 1 },
  meta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  metaDesc: { fontSize: 12, color: Brand.text, marginTop: 4, fontStyle: 'italic' },
  rightCol: { alignItems: 'flex-end' },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },
  deleteBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Brand.red + '55', backgroundColor: Brand.red + '11' },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: Brand.red },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },
});
