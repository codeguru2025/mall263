import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { api } from '@/lib/api';

interface Discount {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrderValue: number | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: string | null;
}

type DiscountType = 'PERCENTAGE' | 'FIXED';

function fmtDiscount(d: Discount) {
  return d.type === 'PERCENTAGE' ? `${d.value}% off` : `$${Number(d.value).toFixed(2)} off`;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString();
}

export default function SellerDiscountsScreen() {
  const { stallId } = useLocalSearchParams<{ stallId: string }>();
  const resolved = Array.isArray(stallId) ? stallId[0] : stallId;
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const discountsQ = useQuery<Discount[]>({
    queryKey: ['seller-discounts', resolved],
    queryFn: () => api.get(`/api/v1/discounts?stallId=${resolved}`).then((r) => r.data),
    enabled: !!resolved,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await discountsQ.refetch(); } finally { setRefreshing(false); }
  }, [discountsQ]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/discounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-discounts', resolved] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not delete.'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/discounts/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-discounts', resolved] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not update.'),
  });

  const discounts = discountsQ.data ?? [];

  return (
    <View style={styles.page}>
      <FlatList
        data={discounts}
        keyExtractor={(d) => d.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>Discount Codes</Text>
            <Text style={styles.sub}>Create promo codes that buyers can apply at checkout.</Text>
            <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
              <FontAwesome name="plus" size={13} color="#fff" />
              <Text style={styles.addBtnText}>New discount</Text>
            </Pressable>
            {showAdd && resolved && (
              <AddDiscountForm
                stallId={resolved}
                onDone={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['seller-discounts', resolved] }); }}
                onCancel={() => setShowAdd(false)}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          discountsQ.isPending ? (
            <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
          ) : (
            <View style={styles.centered}>
              <FontAwesome name="tag" size={40} color={Brand.border} />
              <Text style={styles.emptyText}>No discounts yet.</Text>
              <Text style={styles.muted}>Create a promo code to boost sales.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{item.code}</Text>
              </View>
              <Text style={styles.valueText}>{fmtDiscount(item)}</Text>
              <Switch
                value={item.isActive}
                onValueChange={(v) => toggleMut.mutate({ id: item.id, isActive: v })}
                trackColor={{ false: Brand.border, true: Brand.primary + '88' }}
                thumbColor={item.isActive ? Brand.primary : '#ccc'}
                ios_backgroundColor={Brand.border}
              />
            </View>
            <View style={styles.cardMeta}>
              {item.minOrderValue != null && (
                <Text style={styles.metaText}>Min order: ${Number(item.minOrderValue).toFixed(2)}</Text>
              )}
              {item.maxUses != null && (
                <Text style={styles.metaText}>Uses: {item.usedCount}/{item.maxUses}</Text>
              )}
              {item.expiresAt && (
                <Text style={styles.metaText}>Expires: {fmtDate(item.expiresAt)}</Text>
              )}
              {!item.isActive && <Text style={[styles.metaText, { color: Brand.red }]}>Inactive</Text>}
            </View>
            <Pressable
              style={styles.deleteBtn}
              onPress={() =>
                Alert.alert('Delete discount', `Delete code "${item.code}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(item.id) },
                ])
              }
            >
              <FontAwesome name="trash" size={12} color={Brand.red} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function AddDiscountForm({ stallId, onDone, onCancel }: { stallId: string; onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('');
  const [type, setType] = useState<DiscountType>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const addMut = useMutation({
    mutationFn: () =>
      api.post('/api/v1/discounts', {
        stallId,
        code: code.trim().toUpperCase(),
        type,
        value: parseFloat(value),
        minOrderValue: minOrder ? parseFloat(minOrder) : undefined,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
        expiresAt: expiresAt.trim() ? new Date(expiresAt.trim()).toISOString() : undefined,
      }),
    onSuccess: onDone,
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not create discount.'),
  });

  const onSubmit = () => {
    if (!code.trim()) { Alert.alert('Required', 'Enter a promo code'); return; }
    const v = parseFloat(value);
    if (isNaN(v) || v <= 0) { Alert.alert('Invalid', 'Enter a valid discount value'); return; }
    if (type === 'PERCENTAGE' && v > 100) { Alert.alert('Invalid', 'Percentage cannot exceed 100'); return; }
    addMut.mutate();
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>New discount code</Text>

      <Text style={styles.fieldLabel}>Promo code</Text>
      <TextInput style={styles.input} value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="SAVE20" placeholderTextColor={Brand.muted} autoCapitalize="characters" />

      <Text style={styles.fieldLabel}>Type</Text>
      <View style={styles.typeRow}>
        {(['PERCENTAGE', 'FIXED'] as DiscountType[]).map((t) => (
          <Pressable key={t} style={[styles.typeBtn, type === t && styles.typeBtnActive]} onPress={() => setType(t)}>
            <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
              {t === 'PERCENTAGE' ? '% off' : '$ off'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>{type === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount ($)'}</Text>
      <TextInput style={styles.input} value={value} onChangeText={setValue} placeholder={type === 'PERCENTAGE' ? '20' : '5.00'} placeholderTextColor={Brand.muted} keyboardType="decimal-pad" />

      <Text style={styles.fieldLabel}>Min order value (optional)</Text>
      <TextInput style={styles.input} value={minOrder} onChangeText={setMinOrder} placeholder="10.00" placeholderTextColor={Brand.muted} keyboardType="decimal-pad" />

      <Text style={styles.fieldLabel}>Max uses (optional)</Text>
      <TextInput style={styles.input} value={maxUses} onChangeText={setMaxUses} placeholder="100" placeholderTextColor={Brand.muted} keyboardType="number-pad" />

      <Text style={styles.fieldLabel}>Expires (YYYY-MM-DD, optional)</Text>
      <TextInput style={styles.input} value={expiresAt} onChangeText={setExpiresAt} placeholder="2026-12-31" placeholderTextColor={Brand.muted} />

      <View style={styles.formActions}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.submitBtn, addMut.isPending && styles.btnDisabled]} onPress={onSubmit} disabled={addMut.isPending}>
          {addMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Create</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  list: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 14 },
  heading: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginBottom: 4 },
  sub: { fontSize: 13, color: Brand.muted, lineHeight: 18, marginBottom: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.primary, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  centered: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.navy, marginTop: 12 },
  muted: { fontSize: 13, color: Brand.muted, marginTop: 4, textAlign: 'center' },

  card: { backgroundColor: Brand.card, borderRadius: 14, borderWidth: 1, borderColor: Brand.border, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeBox: { backgroundColor: Brand.primary + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  codeText: { fontSize: 14, fontWeight: '900', color: Brand.primary, letterSpacing: 1 },
  valueText: { flex: 1, fontSize: 15, fontWeight: '800', color: Brand.navy },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  metaText: { fontSize: 11, color: Brand.muted, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Brand.red + '12' },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: Brand.red },

  form: { backgroundColor: Brand.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Brand.border, marginTop: 14 },
  formTitle: { fontSize: 15, fontWeight: '900', color: Brand.navy, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: Brand.pageBg, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.text, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.pageBg, alignItems: 'center' },
  typeBtnActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: Brand.muted },
  typeBtnTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Brand.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: Brand.muted },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Brand.primary, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
});
