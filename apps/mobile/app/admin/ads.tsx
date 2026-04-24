import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { uploadImage } from '@/lib/upload-api';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS'];

type Placement = 'BANNER_TOP' | 'BANNER_BOTTOM' | 'SIDEBAR' | 'INTERSTITIAL';

type Ad = {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  placement: Placement;
  targetRole: string | null;
  isActive: boolean;
  startsAt: string;
  endsAt: string | null;
  impressions: number;
};

const PLACEMENT_LABEL: Record<Placement, string> = {
  BANNER_TOP: 'Top Banner',
  BANNER_BOTTOM: 'Bottom Banner',
  SIDEBAR: 'Sidebar',
  INTERSTITIAL: 'Interstitial',
};

const PLACEMENT_COLOR: Record<Placement, string> = {
  BANNER_TOP: Brand.primary,
  BANNER_BOTTOM: '#0D9488',
  SIDEBAR: '#7C3AED',
  INTERSTITIAL: Brand.orange,
};

const TODAY = new Date().toISOString().slice(0, 10);
const BLANK = { title: '', imageUrl: '', linkUrl: '', placement: 'BANNER_TOP' as Placement, targetRole: '', startsAt: TODAY, endsAt: '' };

async function pickAndUploadImage(onUrl: (url: string) => void) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: true,
    aspect: [16, 5],
  });
  if (result.canceled || !result.assets[0]) return;
  try {
    const url = await uploadImage(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
    onUrl(url);
  } catch {
    Alert.alert('Upload failed', 'Could not upload ad image. Please try again.');
  }
}

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' }); }
  catch { return iso; }
}

export default function AdminAdsScreen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.replace('/admin');
  }, [isAuthenticated, user]);

  const adsQ = useQuery({
    queryKey: ['admin-ads'],
    queryFn: () => api.get<Ad[]>('/api/v1/admin/ads').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await adsQ.refetch(); } finally { setRefreshing(false); }
  }, [adsQ]);

  const toggleAd = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/admin/ads/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ads'] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  const deleteAd = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/ads/${id}`).then((r) => r.data),
    onSuccess: () => { Alert.alert('Deleted', 'Ad removed.'); qc.invalidateQueries({ queryKey: ['admin-ads'] }); },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  const createAd = useMutation({
    mutationFn: (body: object) => api.post('/api/v1/admin/ads', body).then((r) => r.data),
    onSuccess: () => {
      Alert.alert('Created', 'Ad created.');
      setShowForm(false);
      setForm(BLANK);
      qc.invalidateQueries({ queryKey: ['admin-ads'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  function handleCreate() {
    if (!form.title.trim()) { Alert.alert('Validation', 'Title is required'); return; }
    if (!form.startsAt) { Alert.alert('Validation', 'Start date is required'); return; }
    createAd.mutate({
      title: form.title.trim(),
      imageUrl: form.imageUrl || undefined,
      linkUrl: form.linkUrl || undefined,
      placement: form.placement,
      targetRole: form.targetRole || undefined,
      startsAt: form.startsAt,
      endsAt: form.endsAt || undefined,
    });
  }

  function confirmDelete(a: Ad) {
    Alert.alert('Delete ad?', a.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAd.mutate(a.id) },
    ]);
  }

  const renderAd = ({ item }: { item: Ad }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adTitle}>{item.title}</Text>
          <Text style={styles.meta}>{fmtDate(item.startsAt)} – {fmtDate(item.endsAt)}</Text>
          <Text style={styles.meta}>{item.impressions} impressions{item.targetRole ? ` · ${item.targetRole}` : ''}</Text>
          {item.linkUrl && <Text style={styles.metaLink} numberOfLines={1}>{item.linkUrl}</Text>}
        </View>
        <View style={styles.rightCol}>
          <View style={[styles.pill, { backgroundColor: (PLACEMENT_COLOR[item.placement] ?? Brand.muted) + '22' }]}>
            <Text style={[styles.pillText, { color: PLACEMENT_COLOR[item.placement] ?? Brand.muted }]}>
              {PLACEMENT_LABEL[item.placement]}
            </Text>
          </View>
          <Switch
            value={item.isActive}
            onValueChange={(v: boolean) => toggleAd.mutate({ id: item.id, isActive: v })}
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
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New Ad</Text>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(v: string) => setForm((f) => ({ ...f, title: v }))} placeholder="Summer Sale Banner" placeholderTextColor={Brand.muted} />

            <Text style={styles.fieldLabel}>Placement</Text>
            <View style={styles.typeRow}>
              {(Object.keys(PLACEMENT_LABEL) as Placement[]).map((p) => (
                <Pressable key={p} style={[styles.typeChip, form.placement === p && styles.typeChipActive]} onPress={() => setForm((f) => ({ ...f, placement: p }))}>
                  <Text style={[styles.typeChipText, form.placement === p && styles.typeChipTextActive]}>{PLACEMENT_LABEL[p]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Ad Image</Text>
            {form.imageUrl ? (
              <View style={styles.imagePreviewRow}>
                <Image source={{ uri: form.imageUrl }} style={styles.imagePreview} resizeMode="cover" />
                <Pressable style={styles.changeImgBtn} onPress={() => pickAndUploadImage((url) => setForm((f) => ({ ...f, imageUrl: url })))}>
                  <Text style={styles.changeImgText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.uploadBtn} onPress={() => pickAndUploadImage((url) => setForm((f) => ({ ...f, imageUrl: url })))}>
                <Text style={styles.uploadBtnText}>📷 Choose image from library</Text>
              </Pressable>
            )}

            <Text style={styles.fieldLabel}>Link URL</Text>
            <TextInput style={styles.input} value={form.linkUrl} onChangeText={(v: string) => setForm((f) => ({ ...f, linkUrl: v }))} placeholder="https://…" placeholderTextColor={Brand.muted} autoCapitalize="none" keyboardType="url" />

            <Text style={styles.fieldLabel}>Target Role (blank = all)</Text>
            <TextInput style={styles.input} value={form.targetRole} onChangeText={(v: string) => setForm((f) => ({ ...f, targetRole: v }))} placeholder="BUYER / STALL_OWNER / …" placeholderTextColor={Brand.muted} autoCapitalize="characters" />

            <Text style={styles.fieldLabel}>Starts At (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.startsAt} onChangeText={(v: string) => setForm((f) => ({ ...f, startsAt: v }))} placeholder={TODAY} placeholderTextColor={Brand.muted} />

            <Text style={styles.fieldLabel}>Ends At (blank = no expiry)</Text>
            <TextInput style={styles.input} value={form.endsAt} onChangeText={(v: string) => setForm((f) => ({ ...f, endsAt: v }))} placeholder="2026-12-31" placeholderTextColor={Brand.muted} />

            <View style={styles.formActions}>
              <Pressable style={[styles.btn, styles.cancelBtn]} onPress={() => { setShowForm(false); setForm(BLANK); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.primaryBtn, createAd.isPending && styles.btnDisabled]} onPress={handleCreate} disabled={createAd.isPending}>
                {createAd.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Create Ad</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {!showForm && (
          <View style={styles.topBar}>
            <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.addBtnText}>+ New Ad</Text>
            </Pressable>
          </View>
        )}

        {adsQ.isPending ? (
          <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={adsQ.data ?? []}
            keyExtractor={(item: Ad) => item.id}
            renderItem={renderAd}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
            ListHeaderComponent={<Text style={styles.count}>{adsQ.data?.length ?? 0} ad{adsQ.data?.length !== 1 ? 's' : ''}</Text>}
            ListEmptyComponent={<Text style={styles.empty}>No ads yet.</Text>}
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

  formCard: { backgroundColor: Brand.card, borderBottomWidth: 1, borderBottomColor: Brand.border, padding: 16 },
  formTitle: { fontSize: 16, fontWeight: '900', color: Brand.navy, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.text, backgroundColor: Brand.pageBg },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  typeChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Brand.pageBg, borderWidth: 1, borderColor: Brand.border },
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
  adTitle: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  meta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  metaLink: { fontSize: 11, color: Brand.primary, marginTop: 2 },
  rightCol: { alignItems: 'flex-end' },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800' },
  deleteBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Brand.red + '55', backgroundColor: Brand.red + '11' },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: Brand.red },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },

  uploadBtn: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: Brand.pageBg, marginBottom: 0 },
  uploadBtnText: { fontSize: 14, color: Brand.navy, fontWeight: '600' },
  imagePreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  imagePreview: { width: 100, height: 40, borderRadius: 8, backgroundColor: Brand.border },
  changeImgBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Brand.border },
  changeImgText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
});
