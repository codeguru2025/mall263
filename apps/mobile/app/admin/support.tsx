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
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface SupportRow {
  id: string;
  topic: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  adminNotes: string | null;
  assignedToId: string | null;
  createdAt: string;
  contactName: string | null;
  contactPhone: string | null;
  user: { id: string; firstName: string; lastName: string; phone: string } | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
}

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

function statusColor(s: string) {
  switch (s) {
    case 'OPEN': return '#ef4444';
    case 'IN_PROGRESS': return Brand.orange;
    case 'RESOLVED': return Brand.green;
    case 'CLOSED': return Brand.muted;
    default: return Brand.muted;
  }
}

export default function AdminSupportScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery<SupportRow[]>({
    queryKey: ['admin-support-requests', filter],
    queryFn: () =>
      api.get('/api/v1/admin/support-requests', { params: filter ? { status: filter } : {} }).then((r) => r.data),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/api/v1/admin/support-requests/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-support-requests'] }),
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.message ?? 'Update failed'),
  });

  const pickStatus = (row: SupportRow) => {
    Alert.alert(
      'Update status',
      undefined,
      [
        ...STATUSES.map((s) => ({
          text: s.replace(/_/g, ' '),
          onPress: () => patchMut.mutate({ id: row.id, body: { status: s } }),
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const renderRow = ({ item }: { item: SupportRow }) => {
    const isExpanded = expandedId === item.id;
    const who = item.user
      ? `${item.user.firstName} ${item.user.lastName} (${item.user.phone})`
      : `${item.contactName ?? '—'} · ${item.contactPhone ?? '—'}`;

    return (
      <Pressable style={styles.card} onPress={() => setExpandedId(isExpanded ? null : item.id)}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) + '20' }]}>
              <Text style={[styles.statusPillText, { color: statusColor(item.status) }]}>
                {item.status.replace(/_/g, ' ')}
              </Text>
            </View>
            <Text style={styles.topic}>{item.topic}</Text>
            <Text style={styles.who} numberOfLines={1}>{who}</Text>
            <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
          <FontAwesome name={isExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={Brand.muted} style={{ marginLeft: 8 }} />
        </View>

        {isExpanded && (
          <View style={styles.expanded}>
            <Text style={styles.messageText}>{item.message}</Text>

            {item.assignedTo && (
              <Text style={styles.assignedText}>
                Assigned: {item.assignedTo.firstName} {item.assignedTo.lastName}
              </Text>
            )}

            <View style={styles.actionRow}>
              <Pressable style={styles.statusBtn} onPress={() => pickStatus(item)}>
                <FontAwesome name="exchange" size={12} color={Brand.blue} />
                <Text style={styles.statusBtnText}>Change status</Text>
              </Pressable>
              <Pressable
                style={styles.assignBtn}
                onPress={() =>
                  patchMut.mutate({ id: item.id, body: { status: 'IN_PROGRESS', assignedToId: user?.id } })
                }
              >
                <FontAwesome name="user" size={12} color={Brand.navy} />
                <Text style={styles.assignBtnText}>Assign to me</Text>
              </Pressable>
            </View>

            <Text style={styles.notesLabel}>Internal notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notesDraft[item.id] ?? item.adminNotes ?? ''}
              onChangeText={(v: string) => setNotesDraft((d) => ({ ...d, [item.id]: v }))}
              placeholder="Internal notes (visible to admins only)…"
              placeholderTextColor={Brand.muted}
              multiline
              numberOfLines={3}
            />
            <Pressable
              style={styles.saveNotesBtn}
              onPress={() =>
                patchMut.mutate({
                  id: item.id,
                  body: { adminNotes: notesDraft[item.id] ?? item.adminNotes ?? '' },
                })
              }
            >
              {patchMut.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveNotesBtnText}>Save notes</Text>
              )}
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {(['', ...STATUSES] as string[]).map((s) => (
          <Pressable
            key={s || 'all'}
            style={[styles.chip, filter === s && styles.chipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>{s ? s.replace(/_/g, ' ') : 'All'}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={Brand.blue} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r: SupportRow) => r.id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesome name="inbox" size={36} color={Brand.muted} />
              <Text style={styles.emptyText}>No requests in this view</Text>
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
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: Brand.border },
  chipActive: { borderColor: Brand.navy, backgroundColor: Brand.navy },
  chipText: { fontSize: 11, fontWeight: '700', color: Brand.muted },
  chipTextActive: { color: '#fff' },

  list: { padding: 14, paddingBottom: 40 },
  card: { backgroundColor: Brand.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Brand.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 4 },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  topic: { fontSize: 15, fontWeight: '900', color: Brand.navy, marginBottom: 2 },
  who: { fontSize: 12, color: Brand.muted },
  dateText: { fontSize: 11, color: Brand.muted, marginTop: 2 },

  expanded: { borderTopWidth: 1, borderTopColor: Brand.border, marginTop: 12, paddingTop: 12, gap: 10 },
  messageText: { fontSize: 13, color: Brand.text, lineHeight: 20 },
  assignedText: { fontSize: 11, color: Brand.muted, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', gap: 8 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.blue, backgroundColor: '#eff6ff' },
  statusBtnText: { fontSize: 12, fontWeight: '700', color: Brand.blue },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.pageBg },
  assignBtnText: { fontSize: 12, fontWeight: '700', color: Brand.navy },

  notesLabel: { fontSize: 11, fontWeight: '700', color: Brand.navy, textTransform: 'uppercase', letterSpacing: 0.4 },
  notesInput: { backgroundColor: Brand.pageBg, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Brand.text, minHeight: 72, textAlignVertical: 'top' },
  saveNotesBtn: { backgroundColor: Brand.blue, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  saveNotesBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: Brand.muted },
});
