import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { fetchMalls, type Mall } from '@/lib/stalls-api';
import { Brand } from '@/constants/brand';

export default function MallsScreen() {
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: ['malls'],
    queryFn: () => fetchMalls(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = (query.data ?? []).filter((m) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      (m.name ?? '').toLowerCase().includes(needle) ||
      (m.city ?? '').toLowerCase().includes(needle) ||
      (m.address ?? '').toLowerCase().includes(needle)
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <FontAwesome name="search" size={13} color={Brand.muted} />
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search malls or cities"
          placeholderTextColor={Brand.muted}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m: { id: string }) => m.id}
        numColumns={1}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }: { item: Mall }) => <MallCard mall={item} />}
        ListEmptyComponent={
          query.isPending ? (
            <ActivityIndicator color={Brand.blue} style={{ marginTop: 30 }} />
          ) : (
            <View style={styles.emptyBox}>
              <FontAwesome name="building-o" size={30} color={Brand.muted} />
              <Text style={styles.emptyTitle}>No malls found</Text>
              <Text style={styles.emptySub}>
                {q ? 'Try a different search.' : 'Malls will appear here as they come online.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function MallCard({ mall }: { mall: Mall }) {
  const location = [mall.city, mall.address].filter(Boolean).join(' · ');
  const stallCount = mall._count?.stalls;
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/malls/[id]', params: { id: mall.id } })}
    >
      <View style={styles.cardImage}>
        {mall.imageUrl ? (
          <Image source={{ uri: mall.imageUrl }} style={styles.cardImageInner} contentFit="cover" />
        ) : (
          <FontAwesome name="building" size={30} color="#ffffff99" />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{mall.name}</Text>
        {location ? (
          <View style={styles.cardMeta}>
            <FontAwesome name="map-marker" size={11} color={Brand.muted} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}
        {stallCount != null ? (
          <Text style={styles.cardStallCount}>
            {stallCount} {stallCount === 1 ? 'stall' : 'stalls'}
          </Text>
        ) : null}
      </View>
      <FontAwesome name="chevron-right" size={13} color={Brand.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.card,
    paddingHorizontal: 14,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  search: { flex: 1, paddingVertical: 12, fontSize: 14, color: Brand.text },

  listContent: { padding: 14, paddingBottom: 40 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 10,
  },
  cardImage: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: Brand.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardImageInner: { width: '100%', height: '100%' },
  cardBody: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontWeight: '900', color: Brand.navy, letterSpacing: -0.2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { fontSize: 12, color: Brand.muted, flex: 1 },
  cardStallCount: { fontSize: 11, fontWeight: '700', color: Brand.blue, marginTop: 2 },

  emptyBox: {
    alignItems: 'center',
    padding: 36,
    gap: 6,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginTop: 8 },
  emptySub: { fontSize: 13, color: Brand.muted, textAlign: 'center' },
});
