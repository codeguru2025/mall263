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

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS', 'MALL_MANAGER'];

type Mall = {
  id: string;
  name: string;
  address?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
  stallCount?: number;
  city?: { name: string } | string | null;
};

const EMPTY = { name: '', city: '', address: '', latitude: '', longitude: '', imageUrl: '' };

const cardShadow =
  Platform.OS === 'ios'
    ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }
    : { elevation: 1 };

function cityName(city: Mall['city']) {
  if (!city) return '';
  return typeof city === 'string' ? city : city.name;
}

export default function AdminMallsScreen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMall, setEditingMall] = useState<Mall | null>(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.replace('/admin');
  }, [isAuthenticated, user]);

  const mallsQ = useQuery({
    queryKey: ['admin-malls'],
    queryFn: () => api.get<Mall[]>('/api/v1/stalls/admin/malls').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await mallsQ.refetch(); } finally { setRefreshing(false); }
  }, [mallsQ]);

  const createMall = useMutation({
    mutationFn: (body: object) => api.post('/api/v1/stalls/admin/malls', body).then((r) => r.data),
    onSuccess: () => {
      Alert.alert('Created', 'Mall created.');
      closeForm();
      qc.invalidateQueries({ queryKey: ['admin-malls'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  const updateMall = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api.patch(`/api/v1/stalls/admin/malls/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      Alert.alert('Saved', 'Mall updated.');
      closeForm();
      qc.invalidateQueries({ queryKey: ['admin-malls'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/stalls/admin/malls/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-malls'] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Failed'),
  });

  function openCreate() {
    setEditingMall(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function openEdit(m: Mall) {
    setEditingMall(m);
    setForm({
      name: m.name,
      city: cityName(m.city),
      address: m.address ?? '',
      latitude: '',
      longitude: '',
      imageUrl: m.imageUrl ?? '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingMall(null);
    setForm(EMPTY);
  }

  function handleSubmit() {
    if (!form.name.trim()) { Alert.alert('Validation', 'Mall name is required'); return; }
    const body = {
      name: form.name.trim(),
      city: form.city.trim() || undefined,
      address: form.address.trim() || undefined,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      imageUrl: form.imageUrl.trim() || undefined,
    };
    if (editingMall) {
      updateMall.mutate({ id: editingMall.id, body });
    } else {
      createMall.mutate(body);
    }
  }

  function confirmToggle(m: Mall) {
    Alert.alert(
      m.isActive ? 'Deactivate mall?' : 'Activate mall?',
      m.name,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: m.isActive ? 'Deactivate' : 'Activate', onPress: () => toggleActive.mutate({ id: m.id, isActive: !m.isActive }) },
      ],
    );
  }

  const canMutateMalls = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN_OPS';

  const renderMall = ({ item }: { item: Mall }) => (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mallName}>{item.name}</Text>
          {cityName(item.city) && <Text style={styles.meta}>{cityName(item.city)}</Text>}
          {item.address && <Text style={styles.meta}>{item.address}</Text>}
          {typeof item.stallCount === 'number' && <Text style={styles.meta}>{item.stallCount} stall{item.stallCount !== 1 ? 's' : ''}</Text>}
        </View>
        <View style={[styles.pill, { backgroundColor: item.isActive ? Brand.green + '22' : Brand.muted + '22' }]}>
          <Text style={[styles.pillText, { color: item.isActive ? Brand.green : Brand.muted }]}>
            {item.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>
      {canMutateMalls ? (
      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={() => openEdit(item)}>
          <Text style={styles.editBtnText}>✏ Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, item.isActive ? styles.dangerBtn : styles.successBtn]}
          onPress={() => confirmToggle(item)}
        >
          <Text style={styles.actionBtnText}>{item.isActive ? 'Deactivate' : 'Activate'}</Text>
        </Pressable>
      </View>
      ) : null}
    </View>
  );

  const isPending = createMall.isPending || updateMall.isPending;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingMall ? 'Edit Mall' : 'New Mall'}</Text>

            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))} placeholder="Eastgate Mall" placeholderTextColor={Brand.muted} />

            <Text style={styles.fieldLabel}>City</Text>
            <TextInput style={styles.input} value={form.city} onChangeText={(v: string) => setForm((f) => ({ ...f, city: v }))} placeholder="Harare" placeholderTextColor={Brand.muted} />

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={(v: string) => setForm((f) => ({ ...f, address: v }))} placeholder="Robert Mugabe Rd" placeholderTextColor={Brand.muted} />

            <View style={styles.coordRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Latitude</Text>
                <TextInput style={styles.input} value={form.latitude} onChangeText={(v: string) => setForm((f) => ({ ...f, latitude: v }))} placeholder="-17.8" placeholderTextColor={Brand.muted} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Longitude</Text>
                <TextInput style={styles.input} value={form.longitude} onChangeText={(v: string) => setForm((f) => ({ ...f, longitude: v }))} placeholder="31.0" placeholderTextColor={Brand.muted} keyboardType="decimal-pad" />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Mall Image (optional)</Text>
            {form.imageUrl ? (
              <View style={styles.imgPreviewRow}>
                <Image source={{ uri: form.imageUrl }} style={styles.imgPreview} resizeMode="cover" />
                <Pressable
                  style={styles.changeImgBtn}
                  onPress={async () => {
                    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
                    if (!r.canceled && r.assets[0]) {
                      try { setForm((f) => ({ ...f, imageUrl: '' })); const url = await uploadImage(r.assets[0].uri, r.assets[0].mimeType ?? 'image/jpeg'); setForm((f) => ({ ...f, imageUrl: url })); }
                      catch { Alert.alert('Upload failed', 'Could not upload image.'); }
                    }
                  }}
                >
                  <Text style={styles.changeImgText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.uploadBtn}
                onPress={async () => {
                  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
                  if (!r.canceled && r.assets[0]) {
                    try { const url = await uploadImage(r.assets[0].uri, r.assets[0].mimeType ?? 'image/jpeg'); setForm((f) => ({ ...f, imageUrl: url })); }
                    catch { Alert.alert('Upload failed', 'Could not upload image.'); }
                  }
                }}
              >
                <Text style={styles.uploadBtnText}>📷 Choose mall image</Text>
              </Pressable>
            )}

            <View style={styles.formActions}>
              <Pressable style={[styles.btn, styles.cancelBtn]} onPress={closeForm}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.primaryBtn, isPending && styles.btnDisabled]} onPress={handleSubmit} disabled={isPending}>
                {isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>{editingMall ? 'Save' : 'Create'}</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {canMutateMalls && !showForm && (
          <View style={styles.topBar}>
            <Pressable style={styles.addBtn} onPress={openCreate}>
              <Text style={styles.addBtnText}>+ New Mall</Text>
            </Pressable>
          </View>
        )}

        {mallsQ.isPending ? (
          <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
        ) : (
          <FlatList
            data={mallsQ.data ?? []}
            keyExtractor={(item: Mall) => item.id}
            renderItem={renderMall}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
            ListHeaderComponent={<Text style={styles.count}>{mallsQ.data?.length ?? 0} mall{mallsQ.data?.length !== 1 ? 's' : ''}</Text>}
            ListEmptyComponent={<Text style={styles.empty}>No malls yet.</Text>}
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
  coordRow: { flexDirection: 'row', gap: 10 },
  uploadBtn: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingVertical: 13, alignItems: 'center', backgroundColor: Brand.pageBg, marginTop: 4 },
  uploadBtnText: { fontSize: 14, color: Brand.navy, fontWeight: '600' },
  imgPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  imgPreview: { width: 80, height: 50, borderRadius: 8, backgroundColor: Brand.border },
  changeImgBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Brand.border },
  changeImgText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
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
  mallName: { fontSize: 16, fontWeight: '900', color: Brand.navy },
  meta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  editBtn: { backgroundColor: Brand.pageBg, borderWidth: 1, borderColor: Brand.border },
  editBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 13 },
  dangerBtn: { backgroundColor: Brand.red },
  successBtn: { backgroundColor: Brand.green },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: { textAlign: 'center', color: Brand.muted, marginTop: 32 },
});
