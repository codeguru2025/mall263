import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Video, ResizeMode } from 'expo-av';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/products';

interface HotspotProduct {
  id: string;
  name: string;
  minPrice: number | string | null;
  currency: string;
  images: { url?: string; cdnUrl?: string }[];
}

interface Hotspot {
  id: string;
  timestamp: number;
  xCoord: number;
  yCoord: number;
  product: HotspotProduct;
}

interface ShelfVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number | null;
  hotspots: Hotspot[];
}

interface Shelf {
  shelfLayer: string;
  video: ShelfVideo;
}

interface AisleGroup {
  aisleName: string;
  shelves: Shelf[];
}

export default function VirtualWalkScreen() {
  const router = useRouter();
  const { stallId } = useLocalSearchParams<{ stallId: string }>();
  const resolved = Array.isArray(stallId) ? stallId[0] : stallId;

  const [selectedAisle, setSelectedAisle] = useState<string | null>(null);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);

  const aislesQ = useQuery<AisleGroup[]>({
    queryKey: ['virtual-walk', resolved],
    queryFn: () => api.get(`/api/v1/virtual-walk/shop/${resolved}`).then((r) => r.data),
    enabled: !!resolved,
  });

  const stallQ = useQuery({
    queryKey: ['stall-detail', resolved],
    queryFn: () => api.get(`/api/v1/stalls/${resolved}`).then((r) => r.data),
    enabled: !!resolved,
    staleTime: 300_000,
  });

  useEffect(() => {
    const aisles = aislesQ.data;
    if (aisles?.length && !selectedAisle) {
      setSelectedAisle(aisles[0].aisleName);
      setSelectedShelf(aisles[0].shelves[0]?.shelfLayer ?? null);
    }
  }, [aislesQ.data, selectedAisle]);

  const aisles = aislesQ.data ?? [];
  const currentAisle = aisles.find((a) => a.aisleName === selectedAisle);
  const currentShelf = currentAisle?.shelves.find((s) => s.shelfLayer === selectedShelf);
  const stallName = stallQ.data?.name ?? 'Virtual Walk';

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: stallName }} />

      {aislesQ.isPending && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Brand.primary} />
          <Text style={styles.muted}>Loading virtual walk…</Text>
        </View>
      )}

      {aislesQ.isError && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load virtual walk.</Text>
          <Pressable style={styles.retryBtn} onPress={() => aislesQ.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!aislesQ.isPending && !aislesQ.isError && aisles.length === 0 && (
        <View style={styles.centered}>
          <FontAwesome name="video-camera" size={48} color={Brand.border} />
          <Text style={styles.emptyTitle}>No virtual walk yet</Text>
          <Text style={styles.muted}>This store hasn't uploaded any walk videos.</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryText}>Back to store</Text>
          </Pressable>
        </View>
      )}

      {aisles.length > 0 && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Aisle selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {aisles.map((a) => (
              <Pressable
                key={a.aisleName}
                style={[styles.tab, selectedAisle === a.aisleName && styles.tabActive]}
                onPress={() => {
                  setSelectedAisle(a.aisleName);
                  setSelectedShelf(a.shelves[0]?.shelfLayer ?? null);
                }}
              >
                <Text style={[styles.tabText, selectedAisle === a.aisleName && styles.tabTextActive]}>
                  {a.aisleName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Shelf layer tabs */}
          {currentAisle && currentAisle.shelves.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfTabs}
            >
              {currentAisle.shelves.map((s) => (
                <Pressable
                  key={s.shelfLayer}
                  style={[styles.shelfTab, selectedShelf === s.shelfLayer && styles.shelfTabActive]}
                  onPress={() => setSelectedShelf(s.shelfLayer)}
                >
                  <Text style={[styles.shelfTabText, selectedShelf === s.shelfLayer && styles.shelfTabTextActive]}>
                    Shelf {s.shelfLayer}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Video player */}
          {currentShelf ? (
            <VideoBlock video={currentShelf.video} />
          ) : (
            <View style={styles.videoPlaceholder}>
              <FontAwesome name="play-circle" size={48} color={Brand.muted} />
            </View>
          )}

          {/* Hotspot product list */}
          {currentShelf && currentShelf.video.hotspots.length > 0 && (
            <View style={styles.hotspotSection}>
              <Text style={styles.sectionLabel}>Products in this view</Text>
              {currentShelf.video.hotspots.map((h) => (
                <HotspotCard key={h.id} hotspot={h} />
              ))}
            </View>
          )}

          {/* All sections overview */}
          <View style={styles.overviewCard}>
            <Text style={styles.sectionLabel}>All sections</Text>
            {aisles.map((a) =>
              a.shelves.map((s) => {
                const isActive = a.aisleName === selectedAisle && s.shelfLayer === selectedShelf;
                const thumb = s.video.thumbnailUrl;
                return (
                  <Pressable
                    key={s.video.id}
                    style={[styles.overviewRow, isActive && styles.overviewRowActive]}
                    onPress={() => { setSelectedAisle(a.aisleName); setSelectedShelf(s.shelfLayer); }}
                  >
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.overviewThumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.overviewThumb, styles.overviewThumbPh]}>
                        <FontAwesome name="play" size={12} color={Brand.muted} />
                      </View>
                    )}
                    <Text style={[styles.overviewLabel, isActive && styles.overviewLabelActive]} numberOfLines={1}>
                      {a.aisleName} — {s.shelfLayer}
                    </Text>
                    {s.video.hotspots.length > 0 && (
                      <View style={styles.hotspotBadge}>
                        <Text style={styles.hotspotBadgeText}>{s.video.hotspots.length}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              }),
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function VideoBlock({ video }: { video: ShelfVideo }) {
  const videoRef = useRef<InstanceType<typeof Video>>(null);

  return (
    <View style={styles.videoWrapper}>
      <Video
        ref={videoRef}
        source={{ uri: video.videoUrl }}
        style={styles.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        posterSource={video.thumbnailUrl ? { uri: video.thumbnailUrl } : undefined}
        usePoster={!!video.thumbnailUrl}
      />
    </View>
  );
}

function HotspotCard({ hotspot }: { hotspot: Hotspot }) {
  const router = useRouter();
  const img = hotspot.product.images[0]?.cdnUrl || hotspot.product.images[0]?.url;
  const price = hotspot.product.minPrice ? parseFloat(String(hotspot.product.minPrice)) : null;

  return (
    <Pressable
      style={styles.hotspotCard}
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: hotspot.product.id } })}
    >
      {img ? (
        <Image source={{ uri: img }} style={styles.hotspotImg} contentFit="contain" />
      ) : (
        <View style={[styles.hotspotImg, styles.hotspotImgPh]}>
          <FontAwesome name="shopping-bag" size={16} color={Brand.muted} />
        </View>
      )}
      <View style={styles.hotspotInfo}>
        <Text style={styles.hotspotName} numberOfLines={2}>{hotspot.product.name}</Text>
        {price !== null && isFinite(price) && price > 0 && (
          <Text style={styles.hotspotPrice}>{formatMoney(price, hotspot.product.currency || 'USD')}</Text>
        )}
      </View>
      <FontAwesome name="chevron-right" size={12} color={Brand.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { marginTop: 8, color: Brand.muted, textAlign: 'center' },
  errorText: { fontSize: 15, fontWeight: '700', color: Brand.red, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Brand.navy, marginTop: 12, marginBottom: 6 },
  retryBtn: { marginTop: 16, backgroundColor: Brand.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  content: { padding: 14, paddingBottom: 40 },

  tabs: { gap: 8, paddingBottom: 12 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
    backgroundColor: Brand.card, borderWidth: 1.5, borderColor: Brand.border,
  },
  tabActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  tabTextActive: { color: '#fff' },

  shelfTabs: { gap: 6, paddingBottom: 10 },
  shelfTab: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border,
  },
  shelfTabActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  shelfTabText: { fontSize: 12, fontWeight: '600', color: Brand.muted },
  shelfTabTextActive: { color: '#fff' },

  videoWrapper: {
    backgroundColor: '#000', borderRadius: 16, overflow: 'hidden',
    marginBottom: 14, aspectRatio: 16 / 9,
  },
  video: { flex: 1 },
  videoPlaceholder: {
    aspectRatio: 16 / 9, backgroundColor: '#111', borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },

  hotspotSection: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  hotspotCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Brand.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 8,
  },
  hotspotImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: Brand.pageBg },
  hotspotImgPh: { justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.border },
  hotspotInfo: { flex: 1 },
  hotspotName: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  hotspotPrice: { fontSize: 13, fontWeight: '800', color: Brand.primary, marginTop: 2 },

  overviewCard: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Brand.border,
  },
  overviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  overviewRowActive: { backgroundColor: Brand.primary + '15', borderRadius: 8, paddingHorizontal: 6 },
  overviewThumb: { width: 36, height: 36, borderRadius: 8 },
  overviewThumbPh: { backgroundColor: Brand.pageBg, justifyContent: 'center', alignItems: 'center' },
  overviewLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: Brand.navy },
  overviewLabelActive: { color: Brand.primary, fontWeight: '800' },
  hotspotBadge: {
    backgroundColor: Brand.primary + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  hotspotBadgeText: { fontSize: 11, fontWeight: '800', color: Brand.primary },
});
