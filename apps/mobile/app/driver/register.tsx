import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import axios from 'axios';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { registerDriver } from '@/lib/delivery-api';
import { getApiBaseUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/token-storage';
import { Brand } from '@/constants/brand';

type Vehicle = 'BICYCLE' | 'MOTORBIKE' | 'CAR' | 'VAN' | 'TRUCK';

const VEHICLES: { key: Vehicle; label: string; icon: React.ComponentProps<typeof FontAwesome>['name']; note: string }[] = [
  { key: 'BICYCLE', label: 'Bicycle', icon: 'bicycle', note: 'Short local deliveries' },
  { key: 'MOTORBIKE', label: 'Motorbike', icon: 'motorcycle', note: 'Fast city deliveries' },
  { key: 'CAR', label: 'Car', icon: 'car', note: 'Up to ~4 small packages' },
  { key: 'VAN', label: 'Van', icon: 'truck', note: 'Bulk or fragile items' },
  { key: 'TRUCK', label: 'Truck', icon: 'truck', note: 'Furniture / heavy loads' },
];

export default function DriverRegisterScreen() {
  const [vehicle, setVehicle] = useState<Vehicle>('MOTORBIKE');
  const [kycUri, setKycUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickKyc = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Grant photo access to upload your ID.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setKycUri(result.assets[0].uri);
    }
  };

  const uploadKyc = async (): Promise<string | undefined> => {
    if (!kycUri) return undefined;
    setUploading(true);
    try {
      const token = await getAccessToken();
      const form = new FormData();
      form.append('file', {
        uri: kycUri,
        name: 'kyc.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
      const res = await fetch(`${getApiBaseUrl()}/api/v1/upload/document`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const body = (await res.json()) as { url?: string };
      return body.url;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const kycDocUrl = await uploadKyc();
      await registerDriver({ vehicleType: vehicle, kycDocUrl });
      Alert.alert(
        'Registration sent',
        'Your driver profile is pending KYC review. You can start seeing available jobs once approved.',
        [{ text: 'Go to Driver Hub', onPress: () => router.replace('/jobs') }],
      );
    } catch (err) {
      let msg = 'Could not submit your registration.';
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string | string[] } | undefined;
        const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        if (m) msg = m;
      }
      Alert.alert('Registration failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <FontAwesome name="truck" size={22} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Become a Mall263 driver</Text>
          <Text style={styles.heroSub}>
            Deliver orders across the city, keep your earnings, and get paid fast. All you need is a
            vehicle and a valid ID.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Choose your vehicle</Text>
          <View style={styles.vehicleList}>
            {VEHICLES.map((v) => (
              <Pressable
                key={v.key}
                style={[styles.vehicleRow, vehicle === v.key && styles.vehicleRowActive]}
                onPress={() => setVehicle(v.key)}
                disabled={submitting}
              >
                <View style={[styles.vehicleIcon, vehicle === v.key && styles.vehicleIconActive]}>
                  <FontAwesome name={v.icon} size={16} color={vehicle === v.key ? '#fff' : Brand.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleLabel}>{v.label}</Text>
                  <Text style={styles.vehicleNote}>{v.note}</Text>
                </View>
                {vehicle === v.key ? <FontAwesome name="check-circle" size={18} color={Brand.blue} /> : null}
              </Pressable>
            ))}
          </View>

          <View style={styles.hr} />
          <Text style={styles.section}>KYC: ID / licence photo</Text>
          <Text style={styles.hint}>
            Upload a clear photo of your national ID or driver&apos;s licence. Required before you can
            accept paid jobs.
          </Text>
          <Pressable style={styles.uploadBox} onPress={pickKyc} disabled={submitting || uploading}>
            {kycUri ? (
              <Image source={{ uri: kycUri }} style={styles.uploadedImage} contentFit="cover" />
            ) : (
              <>
                <FontAwesome name="id-card-o" size={28} color={Brand.muted} />
                <Text style={styles.uploadHint}>Tap to pick photo</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.submitBtn, (submitting || uploading) && styles.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={submitting || uploading}
          >
            {submitting || uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="check" size={14} color="#fff" />
                <Text style={styles.submitBtnText}>Submit registration</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 14, paddingBottom: 40, gap: 12 },

  hero: { backgroundColor: Brand.navy, padding: 20, borderRadius: 18 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: '#ffffffcc', fontSize: 13, marginTop: 6, lineHeight: 18 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  section: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  hint: { fontSize: 12, color: Brand.muted, marginBottom: 12, lineHeight: 17 },
  hr: { height: 1, backgroundColor: Brand.border, marginVertical: 18 },

  vehicleList: { gap: 10 },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 12,
    backgroundColor: '#fafbfd',
  },
  vehicleRowActive: { borderColor: Brand.blue, backgroundColor: '#eff6fc' },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e6f1fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIconActive: { backgroundColor: Brand.blue },
  vehicleLabel: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  vehicleNote: { fontSize: 12, color: Brand.muted, marginTop: 2 },

  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.border,
    borderRadius: 14,
    backgroundColor: '#fafbfd',
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
    overflow: 'hidden',
    marginBottom: 14,
  },
  uploadedImage: { width: '100%', height: '100%' },
  uploadHint: { marginTop: 8, color: Brand.muted, fontWeight: '700' },

  submitBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
