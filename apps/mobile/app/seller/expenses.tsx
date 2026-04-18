import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { fetchMeProfile } from '@/lib/me-profile';
import { fetchStallsByMerchant } from '@/lib/seller-api';
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  type ExpenseCategory,
  type ExpenseRow,
} from '@/lib/seller-ops-api';
import { Brand } from '@/constants/brand';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }[] = [
  { key: 'SALARY', label: 'Salary', icon: 'user' },
  { key: 'TRANSPORT', label: 'Transport', icon: 'bus' },
  { key: 'MEALS', label: 'Meals', icon: 'cutlery' },
  { key: 'RENT', label: 'Rent', icon: 'home' },
  { key: 'UTILITIES', label: 'Utilities', icon: 'plug' },
  { key: 'SUPPLIES', label: 'Supplies', icon: 'archive' },
  { key: 'MARKETING', label: 'Marketing', icon: 'bullhorn' },
  { key: 'MAINTENANCE', label: 'Maintenance', icon: 'wrench' },
  { key: 'OTHER', label: 'Other', icon: 'ellipsis-h' },
];

function fmt(v: unknown, currency = 'USD') {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return `${currency} 0.00`;
  return `${currency} ${n.toFixed(2)}`;
}

function rangeDates(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function SellerExpensesScreen() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });
  const merchantId = meQ.data?.merchant?.id;
  const stallsQ = useQuery({
    queryKey: ['my-stalls', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });
  const stallId = stallsQ.data?.[0]?.id;

  const { start, end } = useMemo(() => rangeDates(days), [days]);

  const expensesQ = useQuery({
    queryKey: ['expenses', stallId, days],
    queryFn: () => fetchExpenses(stallId!, { startDate: start, endDate: end, limit: 200 }),
    enabled: !!stallId,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses', stallId] }),
    onError: (err) => Alert.alert('Error', extractErr(err, 'Could not delete expense.')),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await expensesQ.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const confirmDelete = (exp: ExpenseRow) => {
    Alert.alert('Delete expense?', `${exp.category} · ${fmt(exp.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(exp.id) },
    ]);
  };

  if (meQ.isPending || stallsQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Brand.blue} size="large" />
      </View>
    );
  }

  if (!stallId) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="shopping-bag" size={30} color={Brand.muted} />
        <Text style={styles.emptyTitle}>No stall yet</Text>
        <Text style={styles.emptySub}>Set up your stall to start recording expenses.</Text>
      </View>
    );
  }

  const total = expensesQ.data?.reduce((s, e) => {
    const n = Number(e.amount);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0) ?? 0;

  return (
    <View style={styles.container}>
      <FlatList
        data={expensesQ.data ?? []}
        keyExtractor={(e: { id: string }) => e.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total expenses · last {days} days</Text>
              <Text style={styles.summaryAmount}>{fmt(total)}</Text>
              <Text style={styles.summaryRow}>{expensesQ.data?.length ?? 0} entries</Text>
            </View>

            <View style={styles.rangeBar}>
              {[7, 30, 90].map((d) => (
                <Pressable
                  key={d}
                  style={[styles.rangeBtn, days === d && styles.rangeBtnActive]}
                  onPress={() => setDays(d)}
                >
                  <Text style={[styles.rangeBtnText, days === d && styles.rangeBtnTextActive]}>
                    {d}d
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
              <FontAwesome name="plus" size={13} color="#fff" />
              <Text style={styles.addBtnText}>Record expense</Text>
            </Pressable>
          </>
        }
        renderItem={({ item }: { item: ExpenseRow }) => {
          const meta = CATEGORIES.find((c) => c.key === item.category);
          return (
            <Pressable style={styles.row} onLongPress={() => confirmDelete(item)}>
              <View style={styles.rowIcon}>
                <FontAwesome name={meta?.icon ?? 'tag'} size={14} color={Brand.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowAmount}>{fmt(item.amount, item.currency ?? 'USD')}</Text>
                <Text style={styles.rowMeta}>
                  {(meta?.label ?? item.category)} · {new Date(item.occurredAt).toLocaleDateString()}
                </Text>
                {item.description ? (
                  <Text style={styles.rowDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          expensesQ.isPending ? (
            <ActivityIndicator color={Brand.blue} style={{ marginTop: 20 }} />
          ) : (
            <Text style={styles.emptyText}>
              No expenses recorded in this period. Long-press to delete entries.
            </Text>
          )
        }
      />

      <AddExpenseModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        stallId={stallId}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['expenses', stallId] });
          setShowAdd(false);
        }}
      />
    </View>
  );
}

function AddExpenseModal({
  visible,
  onClose,
  stallId,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  stallId: string;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>('SUPPLIES');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const mut = useMutation({
    mutationFn: () => {
      const amt = parseFloat(amount.replace(/,/g, ''));
      if (!Number.isFinite(amt) || amt <= 0) {
        return Promise.reject(new Error('Enter a valid amount.'));
      }
      return createExpense(stallId, {
        category,
        amount: amt,
        description: description.trim() || undefined,
        occurredAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      setAmount('');
      setDescription('');
      setCategory('SUPPLIES');
      onCreated();
    },
    onError: (err) => Alert.alert('Error', extractErr(err, 'Could not save expense.')),
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New expense</Text>
            <Pressable onPress={onClose}>
              <FontAwesome name="close" size={18} color={Brand.muted} />
            </Pressable>
          </View>

          <Text style={styles.label}>Category</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                style={[styles.catChip, category === c.key && styles.catChipActive]}
                onPress={() => setCategory(c.key)}
              >
                <FontAwesome
                  name={c.icon}
                  size={12}
                  color={category === c.key ? '#fff' : Brand.blue}
                />
                <Text style={[styles.catChipText, category === c.key && styles.catChipTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Amount (USD)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#9ca3af"
            editable={!mut.isPending}
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Transport to restock"
            placeholderTextColor="#9ca3af"
            multiline
            editable={!mut.isPending}
          />

          <Pressable
            style={[styles.saveBtn, mut.isPending && styles.saveBtnDisabled]}
            onPress={() => mut.mutate()}
            disabled={mut.isPending}
          >
            {mut.isPending ? <ActivityIndicator color="#fff" /> : (
              <>
                <FontAwesome name="check" size={14} color="#fff" />
                <Text style={styles.saveBtnText}>Save expense</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function extractErr(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { message?: string | string[] } | undefined;
    const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
    if (m) return m;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: Brand.pageBg,
    gap: 8,
  },
  listContent: { padding: 14, paddingBottom: 40 },

  summaryCard: { backgroundColor: Brand.navy, padding: 20, borderRadius: 18, marginBottom: 12 },
  summaryLabel: {
    color: '#ffffff99',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryAmount: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 6, letterSpacing: -0.6 },
  summaryRow: { color: '#ffffffcc', fontSize: 12, marginTop: 6 },

  rangeBar: {
    flexDirection: 'row',
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 10,
  },
  rangeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  rangeBtnActive: { backgroundColor: Brand.blue },
  rangeBtnText: { fontSize: 12, fontWeight: '800', color: Brand.muted },
  rangeBtnTextActive: { color: '#fff' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.blue,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 8,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eff6fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAmount: { fontSize: 15, fontWeight: '900', color: Brand.navy },
  rowMeta: { fontSize: 11, color: Brand.muted, marginTop: 2 },
  rowDesc: { fontSize: 12, color: Brand.text, marginTop: 4, lineHeight: 16 },

  emptyText: {
    textAlign: 'center',
    color: Brand.muted,
    fontSize: 12,
    padding: 20,
    lineHeight: 18,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 6 },
  emptySub: { fontSize: 12, color: Brand.muted, textAlign: 'center' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: Brand.navy },

  label: { fontSize: 12, fontWeight: '800', color: Brand.navy, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fafbfd',
    color: Brand.text,
  },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: '#fff',
  },
  catChipActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  catChipText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
  catChipTextActive: { color: '#fff' },

  saveBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
