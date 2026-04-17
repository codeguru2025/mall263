import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '@/lib/api';
import { Brand } from '@/constants/brand';
import { formatMoney } from '@/lib/products';

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      }
    : { elevation: 2 };

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const q = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/products/${id}`);
      return data as Record<string, unknown>;
    },
    enabled: !!id,
  });

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Missing product.</Text>
      </View>
    );
  }

  if (q.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (q.isError || !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Product not found or failed to load.</Text>
      </View>
    );
  }

  const p = q.data;
  const name = String(p.name ?? '');
  const description = p.description != null ? String(p.description) : '';
  const minPrice = p.minPrice;
  const maxPrice = p.maxPrice;
  const currency = (p.currency as string) || 'USD';
  const images = (p.images as { url: string }[] | undefined) ?? [];
  const hero = images[0]?.url;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={styles.heroWrap}>
        {hero ? (
          <Image source={{ uri: hero }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroPh]}>
            <Text style={styles.heroLetter}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={[styles.panel, cardShadow]}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.price}>
          {formatMoney(minPrice, currency)}
          {String(minPrice) !== String(maxPrice) ? ` – ${formatMoney(maxPrice, currency)}` : ''}
        </Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  body: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  muted: { marginTop: 10, color: Brand.muted, fontSize: 15 },
  error: { color: Brand.red, fontWeight: '700', fontSize: 15 },
  heroWrap: { paddingHorizontal: 16, paddingTop: 12 },
  hero: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 360,
    borderRadius: 16,
    backgroundColor: Brand.border,
  },
  heroPh: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Brand.border },
  heroLetter: { fontSize: 56, fontWeight: '900', color: Brand.blue },
  panel: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  title: { fontSize: 24, fontWeight: '900', color: Brand.navy, lineHeight: 30 },
  price: { fontSize: 20, fontWeight: '800', color: Brand.blue, marginTop: 12 },
  desc: { fontSize: 15, color: '#334155', marginTop: 16, lineHeight: 23 },
});
