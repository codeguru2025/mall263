import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface City {
  id: string;
  name: string;
  country: string;
  province: string | null;
  isActive: boolean;
  _count?: { malls: number; stalls: number };
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN_OPS'];

export default function AdminCitiesScreen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editCity, setEditCity] = useState<City | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user && !ADMIN_ROLES.includes(user.role)) router.replace('/admin');
  }, [isAuthenticated, user]);

  const citiesQ = useQuery<City[]>({
    queryKey: ['admin-cities'],
    queryFn: () => api.get('/api/v1/cities').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await citiesQ.refetch(); } finally { setRefreshing(false); }
  }, [citiesQ]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/cities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-cities'] }),
    onError: (err: any) => { const m = err?.response?.data?.message; Alert.alert('Error', Array.isArray(m) ? m.join('\n') : (m ?? 'Could not delete city.')); },
  });

  const onDelete = (city: City) => {
    const usage = [city._count?.malls && `${city._count.malls} mall(s)`, city._count?.stalls && `${city._count.stalls} stall(s)`].filter(Boolean).join(', ');
    const warn = usage ? `\n\nWarning: this city has ${usage}.` : '';
    Alert.alert('Delete city', `Delete "${city.name}"?${warn}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(city.id) },
    ]);
  };

  const cities = citiesQ.data ?? [];

  return (
    <View style={styles.page}>
      <FlatList
        data={cities}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>Cities</Text>
            <Text style={styles.sub}>Manage the cities used for malls and stall lookup.</Text>
            <Pressable style={styles.addBtn} onPress={() => { setEditCity(null); setShowAdd(true); }}>
              <FontAwesome name="plus" size={13} color="#fff" />
              <Text style={styles.addBtnText}>Add city</Text>
            </Pressable>
            {showAdd && (
              <CityForm
                existing={editCity}
                onDone={() => { setShowAdd(false); setEditCity(null); qc.invalidateQueries({ queryKey: ['admin-cities'] }); }}
                onCancel={() => { setShowAdd(false); setEditCity(null); }}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          citiesQ.isPending ? (
            <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
          ) : (
            <View style={styles.centered}>
              <FontAwesome name="map-marker" size={40} color={Brand.border} />
              <Text style={styles.emptyText}>No cities yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardInfo}>
                <Text style={styles.cityName}>{item.name}</Text>
                <Text style={styles.cityMeta}>
                  {[item.province, item.country].filter(Boolean).join(', ')}
                  {item._count?.malls ? `  ·  ${item._count.malls} mall(s)` : ''}
                </Text>
              </View>
              <View style={[styles.badge, item.isActive ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, item.isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <Pressable style={styles.editBtn} onPress={() => { setEditCity(item); setShowAdd(true); }}>
                <FontAwesome name="pencil" size={12} color={Brand.primary} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => onDelete(item)}>
                <FontAwesome name="trash" size={12} color={Brand.red} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function CityForm({ existing, onDone, onCancel }: { existing: City | null; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [country, setCountry] = useState(existing?.country ?? 'Zimbabwe');
  const [province, setProvince] = useState(existing?.province ?? '');
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), country: country.trim(), province: province.trim() || undefined, isActive };
      if (existing) return api.patch(`/api/v1/cities/${existing.id}`, body);
      return api.post('/api/v1/cities', body);
    },
    onSuccess: onDone,
    onError: (err: any) => { const m = err?.response?.data?.message; Alert.alert('Error', Array.isArray(m) ? m.join('\n') : (m ?? 'Could not save city.')); },
  });

  const onSubmit = () => {
    if (!name.trim()) { Alert.alert('Required', 'Enter a city name'); return; }
    if (!country.trim()) { Alert.alert('Required', 'Enter a country'); return; }
    saveMut.mutate();
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{existing ? 'Edit city' : 'Add city'}</Text>

      <Text style={styles.fieldLabel}>City name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Harare" placeholderTextColor={Brand.muted} />

      <Text style={styles.fieldLabel}>Country</Text>
      <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="Zimbabwe" placeholderTextColor={Brand.muted} />

      <Text style={styles.fieldLabel}>Province (optional)</Text>
      <TextInput style={styles.input} value={province} onChangeText={setProvince} placeholder="Harare Province" placeholderTextColor={Brand.muted} />

      <View style={styles.activeRow}>
        <Text style={styles.fieldLabel}>Active</Text>
        <Pressable style={[styles.toggleBtn, isActive && styles.toggleBtnOn]} onPress={() => setIsActive(!isActive)}>
          <Text style={[styles.toggleText, isActive && styles.toggleTextOn]}>{isActive ? 'Yes' : 'No'}</Text>
        </Pressable>
      </View>

      <View style={styles.formActions}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.submitBtn, saveMut.isPending && styles.btnDisabled]} onPress={onSubmit} disabled={saveMut.isPending}>
          {saveMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>{existing ? 'Save' : 'Add'}</Text>}
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

  card: { backgroundColor: Brand.card, borderRadius: 14, borderWidth: 1, borderColor: Brand.border, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardInfo: { flex: 1 },
  cityName: { fontSize: 16, fontWeight: '800', color: Brand.navy },
  cityMeta: { fontSize: 12, color: Brand.muted, marginTop: 3 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextActive: { color: '#166534' },
  badgeTextInactive: { color: '#991b1b' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Brand.primary + '15', borderWidth: 1, borderColor: Brand.primary + '33' },
  editBtnText: { fontSize: 12, fontWeight: '700', color: Brand.primary },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Brand.red + '12', borderWidth: 1, borderColor: Brand.red + '33' },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: Brand.red },

  form: { backgroundColor: Brand.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Brand.border, marginTop: 14 },
  formTitle: { fontSize: 15, fontWeight: '900', color: Brand.navy, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: Brand.pageBg, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.text, marginBottom: 12 },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.pageBg },
  toggleBtnOn: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  toggleText: { fontSize: 13, fontWeight: '700', color: Brand.muted },
  toggleTextOn: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Brand.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: Brand.muted },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Brand.primary, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
});
