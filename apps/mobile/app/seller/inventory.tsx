import { useCallback, useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { api } from '@/lib/api';

interface InventoryItem {
  variant: {
    id: string;
    sku: string | null;
    options: Record<string, string>;
    sellingPrice: number;
    product: { id: string; name: string };
  };
  quantity: number;
  lowStockThreshold: number | null;
}

type AdjustReason = 'RESTOCK' | 'SALE' | 'DAMAGE' | 'CORRECTION';
const REASONS: AdjustReason[] = ['RESTOCK', 'SALE', 'DAMAGE', 'CORRECTION'];

function variantLabel(item: InventoryItem) {
  const opts = Object.values(item.variant.options ?? {}).join(' / ');
  return [item.variant.product.name, opts].filter(Boolean).join(' — ');
}

export default function SellerInventoryScreen() {
  const { stallId } = useLocalSearchParams<{ stallId: string }>();
  const resolved = Array.isArray(stallId) ? stallId[0] : stallId;
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const inventoryQ = useQuery<InventoryItem[]>({
    queryKey: ['seller-inventory', resolved],
    queryFn: () => api.get(`/api/v1/inventory/stall/${resolved}`).then((r) => r.data),
    enabled: !!resolved,
  });

  const lowStockQ = useQuery<InventoryItem[]>({
    queryKey: ['seller-inventory-low', resolved],
    queryFn: () => api.get(`/api/v1/inventory/stall/${resolved}/low-stock`).then((r) => r.data),
    enabled: !!resolved,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([inventoryQ.refetch(), lowStockQ.refetch()]); } finally { setRefreshing(false); }
  }, [inventoryQ, lowStockQ]);

  const allItems = inventoryQ.data ?? [];
  const lowCount = lowStockQ.data?.length ?? 0;

  const filtered = search.trim()
    ? allItems.filter((i) => variantLabel(i).toLowerCase().includes(search.toLowerCase()) || (i.variant.sku ?? '').toLowerCase().includes(search.toLowerCase()))
    : allItems;

  return (
    <View style={styles.page}>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.variant.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>Inventory</Text>
            {lowCount > 0 && (
              <View style={styles.alertBanner}>
                <FontAwesome name="exclamation-triangle" size={14} color={Brand.orange} />
                <Text style={styles.alertText}>{lowCount} variant{lowCount !== 1 ? 's' : ''} below low-stock threshold</Text>
              </View>
            )}
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search products…"
              placeholderTextColor={Brand.muted}
              clearButtonMode="while-editing"
            />
          </View>
        }
        ListEmptyComponent={
          inventoryQ.isPending ? (
            <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
          ) : (
            <View style={styles.centered}>
              <FontAwesome name="cubes" size={40} color={Brand.border} />
              <Text style={styles.emptyText}>{search ? 'No matches.' : 'No inventory tracked yet.'}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <InventoryRow
            item={item}
            isAdjusting={adjustingId === item.variant.id}
            onToggleAdjust={() => setAdjustingId(adjustingId === item.variant.id ? null : item.variant.id)}
            onAdjusted={() => { setAdjustingId(null); qc.invalidateQueries({ queryKey: ['seller-inventory', resolved] }); qc.invalidateQueries({ queryKey: ['seller-inventory-low', resolved] }); }}
          />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function InventoryRow({ item, isAdjusting, onToggleAdjust, onAdjusted }: {
  item: InventoryItem;
  isAdjusting: boolean;
  onToggleAdjust: () => void;
  onAdjusted: () => void;
}) {
  const isLow = item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold;
  const label = variantLabel(item);

  return (
    <View style={[styles.row, isLow && styles.rowLow]}>
      <View style={styles.rowTop}>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={2}>{label}</Text>
          {item.variant.sku && <Text style={styles.rowSku}>SKU: {item.variant.sku}</Text>}
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.qtyText, isLow && styles.qtyTextLow]}>{item.quantity}</Text>
          <Text style={styles.qtyLabel}>in stock</Text>
        </View>
        <Pressable style={styles.adjustTrigger} onPress={onToggleAdjust}>
          <FontAwesome name={isAdjusting ? 'times' : 'edit'} size={14} color={Brand.primary} />
        </Pressable>
      </View>
      {isLow && item.lowStockThreshold != null && (
        <Text style={styles.lowLabel}>Low stock — threshold: {item.lowStockThreshold}</Text>
      )}
      {isAdjusting && (
        <AdjustForm variantId={item.variant.id} currentQty={item.quantity} onDone={onAdjusted} />
      )}
    </View>
  );
}

function AdjustForm({ variantId, currentQty, onDone }: { variantId: string; currentQty: number; onDone: () => void }) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<AdjustReason>('RESTOCK');
  const [note, setNote] = useState('');

  const adjustMut = useMutation({
    mutationFn: () =>
      api.post('/api/v1/inventory/adjust', {
        variantId,
        delta: parseInt(delta, 10),
        reason,
        note: note.trim() || undefined,
      }),
    onSuccess: onDone,
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not adjust inventory.'),
  });

  const onSubmit = () => {
    const d = parseInt(delta, 10);
    if (isNaN(d) || d === 0) { Alert.alert('Invalid', 'Enter a non-zero quantity change (positive to add, negative to remove)'); return; }
    Alert.alert(
      'Confirm adjustment',
      `${d > 0 ? '+' : ''}${d} units → new stock: ${currentQty + d}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => adjustMut.mutate() },
      ],
    );
  };

  return (
    <View style={styles.adjustForm}>
      <Text style={styles.adjustTitle}>Adjust stock</Text>
      <Text style={styles.fieldLabel}>Change (+add / −remove)</Text>
      <TextInput style={styles.input} value={delta} onChangeText={setDelta} placeholder="+10 or -5" placeholderTextColor={Brand.muted} keyboardType="numbers-and-punctuation" />

      <Text style={styles.fieldLabel}>Reason</Text>
      <View style={styles.reasonRow}>
        {REASONS.map((r) => (
          <Pressable key={r} style={[styles.reasonBtn, reason === r && styles.reasonBtnActive]} onPress={() => setReason(r)}>
            <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Note (optional)</Text>
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="e.g. Received new shipment" placeholderTextColor={Brand.muted} />

      <Pressable style={[styles.submitBtn, adjustMut.isPending && styles.btnDisabled]} onPress={onSubmit} disabled={adjustMut.isPending}>
        {adjustMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Apply adjustment</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  list: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 14 },
  heading: { fontSize: 20, fontWeight: '900', color: Brand.navy, marginBottom: 10 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7ed', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Brand.orange + '55', marginBottom: 10 },
  alertText: { fontSize: 13, fontWeight: '700', color: Brand.orange },
  searchInput: { backgroundColor: Brand.card, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Brand.text },
  centered: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '700', color: Brand.navy, marginTop: 12 },

  row: { backgroundColor: Brand.card, borderRadius: 14, borderWidth: 1, borderColor: Brand.border, padding: 14, marginBottom: 10 },
  rowLow: { borderColor: Brand.orange + '88', backgroundColor: '#fff7ed' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  rowSku: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  rowRight: { alignItems: 'center', marginRight: 4 },
  qtyText: { fontSize: 22, fontWeight: '900', color: Brand.navy },
  qtyTextLow: { color: Brand.orange },
  qtyLabel: { fontSize: 10, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase' },
  adjustTrigger: { padding: 8 },
  lowLabel: { fontSize: 11, color: Brand.orange, fontWeight: '700', marginTop: 6 },

  adjustForm: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Brand.border },
  adjustTitle: { fontSize: 13, fontWeight: '800', color: Brand.navy, marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Brand.navy, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: Brand.pageBg, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Brand.text, marginBottom: 10 },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  reasonBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.pageBg },
  reasonBtnActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  reasonText: { fontSize: 11, fontWeight: '700', color: Brand.muted },
  reasonTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: Brand.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
});
