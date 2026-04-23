import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { api } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceUsd: string | number;
  trialDays: number;
  description: string | null;
  features: string[];
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

const BLANK = {
  name: '',
  slug: '',
  priceUsd: '',
  trialDays: '7',
  description: '',
  features: [''],
  isActive: true,
  isDefault: false,
  sortOrder: '0',
};

export default function AdminSubscriptionPlansScreen() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK);

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['admin-subscription-plans'],
    queryFn: () => api.get('/api/v1/admin/subscription-plans').then((r) => r.data),
  });

  const saveMut = useMutation({
    mutationFn: (payload: object) =>
      editingId
        ? api.patch(`/api/v1/admin/subscription-plans/${editingId}`, payload).then((r) => r.data)
        : api.post('/api/v1/admin/subscription-plans', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-subscription-plans'] });
      closeForm();
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Save failed'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: boolean }) =>
      api.patch(`/api/v1/admin/subscription-plans/${id}`, { [field]: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subscription-plans'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/subscription-plans/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-subscription-plans'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Delete failed'),
  });

  const openCreate = () => { setForm(BLANK); setEditingId(null); setShowModal(true); };
  const openEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      slug: plan.slug,
      priceUsd: String(plan.priceUsd),
      trialDays: String(plan.trialDays),
      description: plan.description ?? '',
      features: plan.features.length ? [...plan.features] : [''],
      isActive: plan.isActive,
      isDefault: plan.isDefault,
      sortOrder: String(plan.sortOrder),
    });
    setEditingId(plan.id);
    setShowModal(true);
  };
  const closeForm = () => { setShowModal(false); setEditingId(null); };

  const handleSave = () => {
    if (!form.name.trim() || !form.priceUsd) { Alert.alert('Required', 'Name and price are required'); return; }
    saveMut.mutate({
      name: form.name.trim(),
      slug: form.slug.trim() || form.name.toLowerCase().replace(/\s+/g, '-'),
      priceUsd: parseFloat(form.priceUsd),
      trialDays: parseInt(form.trialDays) || 7,
      description: form.description.trim() || null,
      features: form.features.filter(Boolean),
      isActive: form.isActive,
      isDefault: form.isDefault,
      sortOrder: parseInt(form.sortOrder) || 0,
    });
  };

  const handleDelete = (plan: Plan) => {
    Alert.alert('Delete plan', `Delete "${plan.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(plan.id) },
    ]);
  };

  const updateFeature = (i: number, val: string) => {
    const updated = [...form.features];
    updated[i] = val;
    setForm((f) => ({ ...f, features: updated }));
  };

  const renderPlan = ({ item }: { item: Plan }) => (
    <View style={[styles.card, item.isDefault && styles.cardDefault]}>
      {item.isDefault && (
        <View style={styles.defaultBadge}>
          <FontAwesome name="check-circle" size={11} color={Brand.green} />
          <Text style={styles.defaultBadgeText}>Default plan</Text>
        </View>
      )}
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{item.name}</Text>
          <Text style={styles.planSlug}>{item.slug}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.planPrice}>${Number(item.priceUsd).toFixed(2)}</Text>
          <Text style={styles.planPriceLabel}>/month</Text>
        </View>
      </View>

      <View style={styles.planMeta}>
        <View style={[styles.badge, item.isActive ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={[styles.badgeText, { color: item.isActive ? Brand.green : Brand.muted }]}>
            {item.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <Text style={styles.trialText}>{item.trialDays}-day trial</Text>
      </View>

      {item.description ? <Text style={styles.planDesc}>{item.description}</Text> : null}

      {item.features.length > 0 && (
        <View style={styles.featureList}>
          {item.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <FontAwesome name="star" size={9} color={Brand.orange} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cardActions}>
        <Switch
          value={item.isActive}
          onValueChange={(v: boolean) => toggleMut.mutate({ id: item.id, field: 'isActive', value: v })}
          trackColor={{ true: Brand.green, false: Brand.border }}
          thumbColor="#fff"
          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
        />
        {!item.isDefault && (
          <Pressable
            style={styles.setDefaultBtn}
            onPress={() => toggleMut.mutate({ id: item.id, field: 'isDefault', value: true })}
          >
            <Text style={styles.setDefaultText}>Set default</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <Pressable style={styles.iconBtn} onPress={() => openEdit(item)}>
          <FontAwesome name="pencil" size={13} color={Brand.blue} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => handleDelete(item)}>
          <FontAwesome name="trash" size={13} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.count}>{plans.length} plans</Text>
        <Pressable style={styles.addBtn} onPress={openCreate}>
          <FontAwesome name="plus" size={13} color="#fff" />
          <Text style={styles.addBtnText}>New plan</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Brand.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p: Plan) => p.id}
          renderItem={renderPlan}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="credit-card" size={36} color={Brand.muted} />
              <Text style={styles.emptyText}>No plans yet</Text>
            </View>
          }
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeForm}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Plan' : 'New Plan'}</Text>
            <Pressable onPress={closeForm}><FontAwesome name="times" size={20} color={Brand.muted} /></Pressable>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Name *</Text>
                <TextInput style={styles.input} value={form.name} onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Premium" placeholderTextColor={Brand.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Slug</Text>
                <TextInput style={styles.input} value={form.slug} onChangeText={(v: string) => setForm((f) => ({ ...f, slug: v.toLowerCase().replace(/\s+/g, '-') }))} placeholder="e.g. premium" placeholderTextColor={Brand.muted} autoCapitalize="none" />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Price (USD) *</Text>
                <TextInput style={styles.input} value={form.priceUsd} onChangeText={(v: string) => setForm((f) => ({ ...f, priceUsd: v }))} placeholder="5.00" placeholderTextColor={Brand.muted} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Trial days</Text>
                <TextInput style={styles.input} value={form.trialDays} onChangeText={(v: string) => setForm((f) => ({ ...f, trialDays: v }))} placeholder="7" placeholderTextColor={Brand.muted} keyboardType="number-pad" />
              </View>
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={form.description} onChangeText={(v: string) => setForm((f) => ({ ...f, description: v }))} placeholder="Short description" placeholderTextColor={Brand.muted} multiline />

            <Text style={styles.label}>Features</Text>
            {form.features.map((feat, i) => (
              <View key={i} style={styles.featureInputRow}>
                <FontAwesome name="star" size={10} color={Brand.orange} style={{ marginTop: 14 }} />
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={feat}
                  onChangeText={(v: string) => updateFeature(i, v)}
                  placeholder="e.g. Full POS & sales management"
                  placeholderTextColor={Brand.muted}
                />
                {form.features.length > 1 && (
                  <Pressable onPress={() => setForm((f) => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }))} style={{ padding: 8 }}>
                    <FontAwesome name="times" size={14} color={Brand.muted} />
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable style={styles.addFeatureBtn} onPress={() => setForm((f) => ({ ...f, features: [...f.features, ''] }))}>
              <FontAwesome name="plus" size={11} color={Brand.green} />
              <Text style={styles.addFeatureText}>Add feature</Text>
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <Switch value={form.isActive} onValueChange={(v: boolean) => setForm((f) => ({ ...f, isActive: v }))} trackColor={{ true: Brand.green, false: Brand.border }} thumbColor="#fff" />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Default plan</Text>
              <Switch value={form.isDefault} onValueChange={(v: boolean) => setForm((f) => ({ ...f, isDefault: v }))} trackColor={{ true: Brand.blue, false: Brand.border }} thumbColor="#fff" />
            </View>
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelBtn} onPress={closeForm}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saveMut.isPending && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save plan</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Brand.border, backgroundColor: Brand.card },
  count: { fontSize: 13, fontWeight: '700', color: Brand.muted },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.navy, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  list: { padding: 14, paddingBottom: 40 },
  card: { backgroundColor: Brand.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: Brand.border },
  cardDefault: { borderColor: Brand.green },
  defaultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  defaultBadgeText: { fontSize: 11, fontWeight: '700', color: Brand.green },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  planName: { fontSize: 16, fontWeight: '900', color: Brand.navy },
  planSlug: { fontSize: 11, fontFamily: 'SpaceMono', color: Brand.muted, marginTop: 2 },
  planPrice: { fontSize: 22, fontWeight: '900', color: Brand.navy },
  planPriceLabel: { fontSize: 11, color: Brand.muted, textAlign: 'right' },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeActive: { backgroundColor: '#f0fdf4' },
  badgeInactive: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  trialText: { fontSize: 11, color: Brand.muted },
  planDesc: { fontSize: 12, color: Brand.muted, marginBottom: 8, lineHeight: 18 },
  featureList: { gap: 4, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 12, color: Brand.navy, flex: 1 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 10 },
  setDefaultBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: Brand.pageBg },
  setDefaultText: { fontSize: 11, fontWeight: '700', color: Brand.muted },
  iconBtn: { padding: 8, borderRadius: 8, backgroundColor: Brand.pageBg },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.muted },

  modal: { flex: 1, backgroundColor: Brand.pageBg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Brand.border, backgroundColor: Brand.card },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  modalBody: { flex: 1, padding: 20 },
  label: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: Brand.card, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Brand.text, marginBottom: 16 },
  row2: { flexDirection: 'row', gap: 12 },
  featureInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  addFeatureBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  addFeatureText: { fontSize: 12, fontWeight: '700', color: Brand.green },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Brand.border },
  switchLabel: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: Brand.border, backgroundColor: Brand.card },
  cancelBtn: { flex: 1, paddingVertical: 14, borderWidth: 2, borderColor: Brand.border, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { fontWeight: '700', color: Brand.navy, fontSize: 15 },
  saveBtn: { flex: 1, paddingVertical: 14, backgroundColor: Brand.navy, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
