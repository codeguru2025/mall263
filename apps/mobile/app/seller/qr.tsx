import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { Brand } from '@/constants/brand';

// react-native-qrcode-svg ships class components incompatible with React 19 strict JSX check
const QR = QRCode as unknown as React.FC<{
  value: string; size?: number; color?: string; backgroundColor?: string; quietZone?: number;
}>;
import { fetchMeProfile } from '@/lib/me-profile';
import { fetchStallsByMerchant } from '@/lib/seller-api';
import { getApiBaseUrl } from '@/lib/config';

function stallWebUrl(stallId: string): string {
  const base = getApiBaseUrl().replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${base}/store/${stallId}`;
}

export default function ShopQrScreen() {
  const [stallIndex, setStallIndex] = useState(0);

  const meQ = useQuery({ queryKey: ['me-profile'], queryFn: fetchMeProfile });
  const merchantId = meQ.data?.merchant?.id;
  const stallsQ = useQuery({
    queryKey: ['my-stalls', merchantId],
    queryFn: () => fetchStallsByMerchant(merchantId!),
    enabled: !!merchantId,
  });

  const stalls = stallsQ.data ?? [];
  const stall = stalls[stallIndex];
  const url = stall ? stallWebUrl(stall.id) : '';

  const handleShare = async () => {
    if (!url) return;
    try {
      await Share.share({
        message: `Visit ${stall?.name ?? 'my shop'} on Mall263: ${url}`,
        url,
      });
    } catch {
      // user cancelled share
    }
  };

  if (meQ.isPending || stallsQ.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  if (!stall) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>No stall found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>{stall.name}</Text>
        {stall.stallNumber ? (
          <Text style={styles.sub}>Stall #{stall.stallNumber}</Text>
        ) : null}
        <Text style={styles.hint}>Customers can scan this code to visit your shop page.</Text>

        <View style={styles.qrWrap}>
          <QR
            value={url}
            size={220}
            color="#0f172a"
            backgroundColor="#fff"
            quietZone={12}
          />
        </View>

        <Text style={styles.urlText} numberOfLines={2}>{url}</Text>

        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share link</Text>
        </Pressable>
      </View>

      {stalls.length > 1 && (
        <View style={styles.pickerRow}>
          {stalls.map((s, i) => (
            <Pressable
              key={s.id}
              style={[styles.pickerChip, stallIndex === i && styles.pickerChipOn]}
              onPress={() => setStallIndex(i)}
            >
              <Text style={[styles.pickerChipText, stallIndex === i && styles.pickerChipTextOn]}>
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg, padding: 20, alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.pageBg },
  error: { color: Brand.red, fontWeight: '700' },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Brand.border,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 12 }
      : { elevation: 4 }),
  },
  title: { fontSize: 20, fontWeight: '900', color: Brand.navy, textAlign: 'center' },
  sub: { fontSize: 13, color: Brand.muted, marginTop: 2 },
  hint: { fontSize: 13, color: Brand.muted, textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 18 },
  qrWrap: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 16,
  },
  urlText: { fontSize: 12, color: Brand.muted, textAlign: 'center', marginBottom: 20 },
  shareBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, justifyContent: 'center' },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  pickerChipOn: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  pickerChipText: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  pickerChipTextOn: { color: '#fff' },
});
