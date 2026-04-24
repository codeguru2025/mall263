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
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { api } from '@/lib/api';

interface Hotspot {
  id: string;
  timestamp: number;
  product: { id: string; name: string };
}

interface ShelfVideo {
  id: string;
  aisleName: string;
  shelfLayer: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  hotspots: Hotspot[];
}

type ShelfLayerOption = 'MIDDLE' | 'TOP' | 'BOTTOM';
const SHELF_LAYERS: ShelfLayerOption[] = ['MIDDLE', 'TOP', 'BOTTOM'];

function fetchVideos(stallId: string): Promise<ShelfVideo[]> {
  return api.get(`/api/v1/virtual-walk/videos/${stallId}`).then((r) => {
    const raw = r.data;
    if (Array.isArray(raw)) return raw;
    const all: ShelfVideo[] = [];
    if (Array.isArray(raw)) return raw;
    // grouped format: [{aisleName, shelves:[{shelfLayer, video:{...}}]}]
    for (const group of raw as any[]) {
      for (const shelf of group.shelves ?? []) {
        all.push({ ...shelf.video, aisleName: group.aisleName, shelfLayer: shelf.shelfLayer });
      }
    }
    return all;
  });
}

export default function SellerVirtualWalkScreen() {
  const router = useRouter();
  const { stallId } = useLocalSearchParams<{ stallId: string }>();
  const resolved = Array.isArray(stallId) ? stallId[0] : stallId;
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const videosQ = useQuery<ShelfVideo[]>({
    queryKey: ['vw-videos', resolved],
    queryFn: () => fetchVideos(resolved!),
    enabled: !!resolved,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await videosQ.refetch(); } finally { setRefreshing(false); }
  }, [videosQ]);

  const deleteMut = useMutation({
    mutationFn: (videoId: string) => api.delete(`/api/v1/virtual-walk/videos/${videoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vw-videos', resolved] }),
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not delete.'),
  });

  const onDelete = (video: ShelfVideo) => {
    Alert.alert('Delete video', `Remove "${video.aisleName} – ${video.shelfLayer}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(video.id) },
    ]);
  };

  const videos = videosQ.data ?? [];

  return (
    <View style={styles.page}>
      <FlatList
        data={videos}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.heading}>Virtual Walk Videos</Text>
            <Text style={styles.sub}>
              Add aisle walk videos so buyers can browse your stall virtually. Each video can have product hotspot pins.
            </Text>
            <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
              <FontAwesome name="plus" size={13} color="#fff" />
              <Text style={styles.addBtnText}>Add video</Text>
            </Pressable>
            {showAdd && resolved && (
              <AddVideoForm stallId={resolved} onDone={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['vw-videos', resolved] }); }} onCancel={() => setShowAdd(false)} />
            )}
          </View>
        }
        ListEmptyComponent={
          videosQ.isPending ? (
            <View style={styles.centered}><ActivityIndicator color={Brand.primary} /></View>
          ) : (
            <View style={styles.centered}>
              <FontAwesome name="video-camera" size={40} color={Brand.border} />
              <Text style={styles.emptyText}>No walk videos yet.</Text>
              <Text style={styles.muted}>Tap "Add video" to upload your first aisle walk.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            stallId={resolved!}
            onDelete={() => onDelete(item)}
            onManageHotspots={() => router.push({ pathname: '/seller/virtual-walk-hotspots', params: { videoId: item.id, stallId: resolved } } as never)}
          />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function VideoCard({ video, onDelete, onManageHotspots }: { video: ShelfVideo; stallId: string; onDelete: () => void; onManageHotspots: () => void }) {
  return (
    <View style={styles.card}>
      {video.thumbnailUrl ? (
        <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPh]}>
          <FontAwesome name="play-circle" size={28} color={Brand.muted} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{video.aisleName}</Text>
        <Text style={styles.cardSub}>Shelf: {video.shelfLayer}</Text>
        {video.duration != null && (
          <Text style={styles.cardMeta}>{Math.round(video.duration)}s · {video.hotspots?.length ?? 0} hotspot{(video.hotspots?.length ?? 0) !== 1 ? 's' : ''}</Text>
        )}
        <View style={styles.cardActions}>
          <Pressable style={styles.hotspotBtn} onPress={onManageHotspots}>
            <FontAwesome name="map-pin" size={12} color={Brand.primary} />
            <Text style={styles.hotspotBtnText}>Hotspots</Text>
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={onDelete}>
            <FontAwesome name="trash" size={12} color={Brand.red} />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AddVideoForm({ stallId, onDone, onCancel }: { stallId: string; onDone: () => void; onCancel: () => void }) {
  const [aisleName, setAisleName] = useState('');
  const [shelfLayer, setShelfLayer] = useState<ShelfLayerOption>('MIDDLE');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  const addMut = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/virtual-walk/videos/${stallId}`, {
        aisleName: aisleName.trim(),
        shelfLayer,
        videoUrl: videoUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
      }),
    onSuccess: onDone,
    onError: (err: any) => Alert.alert('Error', err?.response?.data?.message ?? 'Could not add video.'),
  });

  const onSubmit = () => {
    if (!aisleName.trim()) { Alert.alert('Required', 'Enter an aisle name (e.g. "Electronics")'); return; }
    if (!videoUrl.trim()) { Alert.alert('Required', 'Paste the hosted video URL'); return; }
    addMut.mutate();
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Add aisle video</Text>

      <Text style={styles.fieldLabel}>Aisle name</Text>
      <TextInput style={styles.input} value={aisleName} onChangeText={setAisleName} placeholder="e.g. Electronics, Clothing…" placeholderTextColor={Brand.muted} />

      <Text style={styles.fieldLabel}>Shelf layer</Text>
      <View style={styles.layerRow}>
        {SHELF_LAYERS.map((l) => (
          <Pressable key={l} style={[styles.layerBtn, shelfLayer === l && styles.layerBtnActive]} onPress={() => setShelfLayer(l)}>
            <Text style={[styles.layerBtnText, shelfLayer === l && styles.layerBtnTextActive]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Video URL</Text>
      <TextInput style={styles.input} value={videoUrl} onChangeText={setVideoUrl} placeholder="https://…/video.mp4" placeholderTextColor={Brand.muted} autoCapitalize="none" keyboardType="url" />
      <Text style={styles.hint}>Host your video on Cloudinary, S3, or any CDN and paste the direct URL.</Text>

      <Text style={styles.fieldLabel}>Thumbnail URL (optional)</Text>
      <TextInput style={styles.input} value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://…/thumb.jpg" placeholderTextColor={Brand.muted} autoCapitalize="none" keyboardType="url" />

      <View style={styles.formActions}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.submitBtn, addMut.isPending && styles.btnDisabled]} onPress={onSubmit} disabled={addMut.isPending}>
          {addMut.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Add video</Text>}
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

  card: {
    flexDirection: 'row', backgroundColor: Brand.card, borderRadius: 14,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 12, overflow: 'hidden',
  },
  thumb: { width: 100, height: 90 },
  thumbPh: { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  cardSub: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  cardMeta: { fontSize: 11, color: Brand.muted },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  hotspotBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Brand.primary + '15', borderWidth: 1, borderColor: Brand.primary + '33' },
  hotspotBtnText: { fontSize: 12, fontWeight: '700', color: Brand.primary },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Brand.red + '12', borderWidth: 1, borderColor: Brand.red + '33' },
  deleteBtnText: { fontSize: 12, fontWeight: '700', color: Brand.red },

  form: { backgroundColor: Brand.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Brand.border, marginTop: 14 },
  formTitle: { fontSize: 15, fontWeight: '900', color: Brand.navy, marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: Brand.pageBg, borderWidth: 1.5, borderColor: Brand.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Brand.text, marginBottom: 12,
  },
  hint: { fontSize: 11, color: Brand.muted, marginTop: -8, marginBottom: 12 },
  layerRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  layerBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: Brand.border, backgroundColor: Brand.pageBg, alignItems: 'center' },
  layerBtnActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  layerBtnText: { fontSize: 12, fontWeight: '700', color: Brand.muted },
  layerBtnTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Brand.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: Brand.muted },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Brand.primary, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
});
