import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { api } from '@/lib/api';
import { uploadImage } from '@/lib/upload-api';
import { useAuth } from '@/contexts/AuthContext';

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  imageUrl: string | null;
  isActive: boolean;
  parent?: { id: string; name: string } | null;
  children?: { id: string }[];
  _count?: { products: number };
}

const BLANK = { name: '', parentId: '', imageUrl: '' };

export default function AdminCategoriesScreen() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(BLANK);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => api.get('/api/v1/admin/categories').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const createMut = useMutation({
    mutationFn: (data: object) => api.post('/api/v1/admin/categories', data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to create'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.patch(`/api/v1/admin/categories/${id}`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-categories'] }); closeModal(); },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/admin/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to delete'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/v1/admin/categories/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-categories'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
  });

  const openCreate = () => { setEditing(null); setForm(BLANK); setShowModal(true); };
  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, parentId: cat.parentId ?? '', imageUrl: cat.imageUrl ?? '' });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(BLANK); };

  const handleSave = () => {
    if (!form.name.trim()) { Alert.alert('Required', 'Category name is required'); return; }
    const payload = {
      name: form.name.trim(),
      parentId: form.parentId || undefined,
      imageUrl: form.imageUrl || undefined,
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const handleDelete = (cat: Category) => {
    Alert.alert('Delete category', `Delete "${cat.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(cat.id) },
    ]);
  };

  const topLevel = categories.filter((c) => !c.parentId);

  const renderItem = ({ item }: { item: Category }) => (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <View style={[styles.iconBox, { backgroundColor: item.isActive ? '#f0fdf4' : '#f3f4f6' }]}>
          <FontAwesome name="tag" size={16} color={item.isActive ? Brand.green : Brand.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.catName}>{item.name}</Text>
          <View style={styles.metaRow}>
            {item.parent && (
              <Text style={styles.parentBadge}>↳ {item.parent.name}</Text>
            )}
            <Text style={styles.metaText}>
              {item._count?.products ?? 0} product{item._count?.products !== 1 ? 's' : ''}
              {item.children?.length ? `  ·  ${item.children.length} sub` : ''}
            </Text>
          </View>
          {!item.isActive && <Text style={styles.inactiveBadge}>Inactive</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        <Switch
          value={item.isActive}
          onValueChange={(v: boolean) => toggleMut.mutate({ id: item.id, isActive: v })}
          trackColor={{ true: Brand.green, false: Brand.border }}
          thumbColor="#fff"
          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
        />
        <Pressable style={styles.actionBtn} onPress={() => openEdit(item)}>
          <FontAwesome name="pencil" size={13} color={Brand.blue} />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => handleDelete(item)}>
          <FontAwesome name="trash" size={13} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.count}>{categories.length} categories</Text>
        <Pressable style={styles.addBtn} onPress={openCreate}>
          <FontAwesome name="plus" size={13} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Brand.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c: Category) => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="tags" size={36} color={Brand.muted} />
              <Text style={styles.emptyText}>No categories yet</Text>
            </View>
          }
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Category' : 'New Category'}</Text>
            <Pressable onPress={closeModal}><FontAwesome name="times" size={20} color={Brand.muted} /></Pressable>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))}
              placeholder="e.g. Electronics"
              placeholderTextColor={Brand.muted}
            />

            <Text style={styles.label}>Parent Category (optional)</Text>
            <View style={styles.pickerWrap}>
              <Pressable
                style={styles.input}
                onPress={() => {
                  Alert.alert(
                    'Parent category',
                    'Select a parent',
                    [
                      { text: 'None (top-level)', onPress: () => setForm((f) => ({ ...f, parentId: '' })) },
                      ...topLevel
                        .filter((c) => !editing || c.id !== editing.id)
                        .map((c) => ({ text: c.name, onPress: () => setForm((f) => ({ ...f, parentId: c.id })) })),
                      { text: 'Cancel', style: 'cancel' },
                    ],
                  );
                }}
              >
                <Text style={{ color: form.parentId ? Brand.text : Brand.muted }}>
                  {form.parentId ? (topLevel.find((c) => c.id === form.parentId)?.name ?? form.parentId) : 'None (top-level)'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Category Image (optional)</Text>
            {form.imageUrl ? (
              <View style={styles.imgRow}>
                <Image source={{ uri: form.imageUrl }} style={styles.imgPreview} resizeMode="cover" />
                <Pressable style={styles.changeImgBtn} onPress={async () => {
                  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
                  if (!r.canceled && r.assets[0]) {
                    try { const url = await uploadImage(r.assets[0].uri, r.assets[0].mimeType ?? 'image/jpeg'); setForm((f) => ({ ...f, imageUrl: url })); }
                    catch { Alert.alert('Upload failed', 'Could not upload image.'); }
                  }
                }}>
                  <Text style={styles.changeImgText}>Change image</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.uploadBtn} onPress={async () => {
                const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] });
                if (!r.canceled && r.assets[0]) {
                  try { const url = await uploadImage(r.assets[0].uri, r.assets[0].mimeType ?? 'image/jpeg'); setForm((f) => ({ ...f, imageUrl: url })); }
                  catch { Alert.alert('Upload failed', 'Could not upload image.'); }
                }
              }}>
                <Text style={styles.uploadBtnText}>📷 Choose category image</Text>
              </Pressable>
            )}
          </ScrollView>
          <View style={styles.modalFooter}>
            <Pressable style={styles.cancelBtn} onPress={closeModal}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, (createMut.isPending || updateMut.isPending) && styles.btnDisabled]}
              onPress={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {createMut.isPending || updateMut.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>
              )}
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  list: { padding: 14, paddingBottom: 40 },
  card: { backgroundColor: Brand.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Brand.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  parentBadge: { fontSize: 11, color: Brand.blue, fontWeight: '700', backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  metaText: { fontSize: 11, color: Brand.muted },
  inactiveBadge: { fontSize: 10, color: Brand.muted, fontWeight: '700', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 10 },
  actionBtn: { padding: 8, borderRadius: 8, backgroundColor: Brand.pageBg },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.muted },

  modal: { flex: 1, backgroundColor: Brand.pageBg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Brand.border, backgroundColor: Brand.card },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  modalBody: { flex: 1, padding: 20 },
  label: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: Brand.card, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Brand.text, marginBottom: 16 },
  pickerWrap: { marginBottom: 16 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: Brand.border, backgroundColor: Brand.card },
  cancelBtn: { flex: 1, paddingVertical: 14, borderWidth: 2, borderColor: Brand.border, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { fontWeight: '700', color: Brand.navy, fontSize: 15 },
  saveBtn: { flex: 1, paddingVertical: 14, backgroundColor: Brand.green, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  uploadBtn: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingVertical: 13, alignItems: 'center', backgroundColor: Brand.card, marginBottom: 16 },
  uploadBtnText: { fontSize: 14, color: Brand.navy, fontWeight: '600' },
  imgRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  imgPreview: { width: 56, height: 56, borderRadius: 10, backgroundColor: Brand.border },
  changeImgBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Brand.border },
  changeImgText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
});
