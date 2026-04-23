import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { api } from '@/lib/api';

interface Dispute {
  id: string;
  status: string;
  reason: string;
  resolution: string | null;
  createdAt: string;
  jobId: string | null;
  job?: { mode?: string; itemAmount?: string | null } | null;
  raisedBy?: { firstName: string; lastName: string } | null;
}

const STATUS_FILTERS = ['OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_RESERVE'];

const OUTCOME_OPTIONS = [
  { value: 'RESOLVED_SELLER', label: 'Favour Seller — release escrow to seller' },
  { value: 'RESOLVED_BUYER', label: 'Favour Buyer — refund escrow to buyer' },
  { value: 'RESOLVED_RESERVE', label: 'Split to Reserve — send to risk pool' },
];

function statusColor(s: string) {
  switch (s) {
    case 'OPEN': return '#ef4444';
    case 'UNDER_REVIEW': return Brand.orange;
    case 'RESOLVED_SELLER':
    case 'RESOLVED_BUYER': return Brand.green;
    default: return Brand.muted;
  }
}

export default function AdminDisputesScreen() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('OPEN');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('RESOLVED_BUYER');
  const [resolutionNote, setResolutionNote] = useState('');

  const { data: disputes = [], isLoading, refetch } = useQuery<Dispute[]>({
    queryKey: ['admin-disputes', filter],
    queryFn: () => api.get('/api/v1/disputes', { params: { status: filter || undefined } }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/v1/disputes/${id}/resolve`, { outcome, resolution: resolutionNote }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-disputes'] });
      setResolvingId(null);
      setResolutionNote('');
      Alert.alert('Done', 'Dispute resolved.');
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed to resolve'),
  });

  const underReviewMut = useMutation({
    mutationFn: (id: string) => api.patch(`/api/v1/disputes/${id}/status`, { status: 'UNDER_REVIEW' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-disputes'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Failed'),
  });

  const handleResolve = (id: string) => {
    if (!resolutionNote.trim()) { Alert.alert('Required', 'Resolution note is required'); return; }
    resolveMut.mutate(id);
  };

  const renderDispute = ({ item }: { item: Dispute }) => {
    const isOpen = ['OPEN', 'UNDER_REVIEW'].includes(item.status);
    const isExpanded = resolvingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
              {item.status.replace(/_/g, ' ')}
            </Text>
          </View>
          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>

        <Text style={styles.reason}>"{item.reason}"</Text>

        <View style={styles.metaGrid}>
          <Text style={styles.metaCell}>
            Job: <Text style={styles.metaMono}>{item.jobId?.slice(0, 8) ?? '—'}…</Text>
          </Text>
          <Text style={styles.metaCell}>
            Mode: <Text style={styles.metaValue}>{item.job?.mode?.replace(/_/g, ' ') ?? '—'}</Text>
          </Text>
          <Text style={styles.metaCell}>
            Raised by: <Text style={styles.metaValue}>
              {item.raisedBy ? `${item.raisedBy.firstName} ${item.raisedBy.lastName}` : '—'}
            </Text>
          </Text>
        </View>

        {item.resolution && (
          <View style={styles.resolutionBox}>
            <Text style={styles.resolutionText}>Resolution: {item.resolution}</Text>
          </View>
        )}

        {isOpen && (
          <View style={styles.actionRow}>
            {item.status === 'OPEN' && (
              <Pressable
                style={styles.reviewBtn}
                onPress={() => underReviewMut.mutate(item.id)}
                disabled={underReviewMut.isPending}
              >
                <Text style={styles.reviewBtnText}>Mark Under Review</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.resolveBtn, isExpanded && styles.resolveBtnActive]}
              onPress={() => setResolvingId(isExpanded ? null : item.id)}
            >
              <Text style={styles.resolveBtnText}>{isExpanded ? 'Cancel' : 'Resolve'}</Text>
            </Pressable>
          </View>
        )}

        {isExpanded && (
          <View style={styles.resolveForm}>
            <Text style={styles.resolveTitle}>Resolve Dispute</Text>
            {OUTCOME_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.outcomeBtn, outcome === opt.value && styles.outcomeBtnActive]}
                onPress={() => setOutcome(opt.value)}
              >
                <Text style={[styles.outcomeBtnText, outcome === opt.value && styles.outcomeBtnTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
            <TextInput
              style={styles.noteInput}
              value={resolutionNote}
              onChangeText={setResolutionNote}
              placeholder="Resolution note (visible to both parties)…"
              placeholderTextColor={Brand.muted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.confirmRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setResolvingId(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, (resolveMut.isPending || !resolutionNote.trim()) && styles.btnDisabled]}
                onPress={() => handleResolve(item.id)}
                disabled={resolveMut.isPending || !resolutionNote.trim()}
              >
                {resolveMut.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <FontAwesome name="check-circle" size={14} color="#fff" />
                    <Text style={styles.confirmBtnText}>Confirm Resolution</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {['', ...STATUS_FILTERS].map((s) => (
          <Pressable
            key={s || 'all'}
            style={[styles.chip, filter === s && styles.chipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>{s || 'All'}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={Brand.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(d: Dispute) => d.id}
          renderItem={renderDispute}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="check-circle" size={36} color={Brand.muted} />
              <Text style={styles.emptyText}>No disputes in this category</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  filterBar: { borderBottomWidth: 1, borderBottomColor: Brand.border, backgroundColor: Brand.card, flexGrow: 0 },
  filterContent: { flexDirection: 'row', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 2, borderColor: Brand.border, backgroundColor: Brand.pageBg },
  chipActive: { borderColor: Brand.blue, backgroundColor: '#eff6ff' },
  chipText: { fontSize: 11, fontWeight: '700', color: Brand.muted },
  chipTextActive: { color: Brand.blue },

  list: { padding: 14, paddingBottom: 40 },
  card: { backgroundColor: Brand.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: Brand.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },
  dateText: { fontSize: 11, color: Brand.muted },
  reason: { fontSize: 14, fontWeight: '700', color: Brand.navy, marginBottom: 10, fontStyle: 'italic' },
  metaGrid: { gap: 4, marginBottom: 10 },
  metaCell: { fontSize: 12, color: Brand.muted },
  metaMono: { fontFamily: 'SpaceMono', color: Brand.navy, fontSize: 11 },
  metaValue: { fontWeight: '700', color: Brand.navy },
  resolutionBox: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10, marginBottom: 10 },
  resolutionText: { fontSize: 12, color: Brand.green, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 10 },
  reviewBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: Brand.orange },
  reviewBtnText: { fontSize: 12, fontWeight: '700', color: Brand.orange },
  resolveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Brand.blue },
  resolveBtnActive: { backgroundColor: Brand.muted },
  resolveBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  resolveForm: { borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 14, marginTop: 10, gap: 8 },
  resolveTitle: { fontSize: 12, fontWeight: '900', color: Brand.navy, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  outcomeBtn: { padding: 12, borderRadius: 12, borderWidth: 2, borderColor: Brand.border, backgroundColor: Brand.pageBg },
  outcomeBtnActive: { borderColor: Brand.blue, backgroundColor: '#eff6ff' },
  outcomeBtnText: { fontSize: 13, color: Brand.muted },
  outcomeBtnTextActive: { color: Brand.blue, fontWeight: '700' },
  noteInput: { backgroundColor: Brand.pageBg, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Brand.text, minHeight: 72, textAlignVertical: 'top' },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderWidth: 2, borderColor: Brand.border, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { fontWeight: '700', color: Brand.navy },
  confirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: Brand.blue, borderRadius: 12 },
  confirmBtnText: { fontWeight: '800', color: '#fff', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.muted },
});
