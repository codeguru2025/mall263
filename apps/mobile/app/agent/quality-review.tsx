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
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { createTask } from '@/lib/agent-api';
import { enqueueTask } from '@/lib/agent-queue';
import { getApiBaseUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/token-storage';

type Rating = 1 | 2 | 3 | 4 | 5;

const CRITERIA = [
  { key: 'imageQuality', label: 'Image quality', desc: 'Photos are clear, well-lit, and show the product accurately' },
  { key: 'descriptionAccuracy', label: 'Description accuracy', desc: 'Product name, description, and category are correct and complete' },
  { key: 'pricingFairness', label: 'Pricing', desc: 'Price is realistic and matches the physical product' },
  { key: 'stockAccuracy', label: 'Stock accuracy', desc: 'Inventory quantities match what is physically available' },
  { key: 'stallPresentation', label: 'Stall presentation', desc: 'Overall stall is tidy, branding is correct, staff are present' },
];

export default function QualityReviewScreen() {
  const [stallId, setStallId] = useState('');
  const [productId, setProductId] = useState('');
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState<'APPROVE' | 'NEEDS_WORK' | 'REJECT' | ''>('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setRating = (key: string, val: Rating) =>
    setRatings((prev) => ({ ...prev, [key]: val }));

  const avgRating = () => {
    const vals = Object.values(ratings);
    if (vals.length === 0) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) { Alert.alert('Permission required', 'Grant camera or photo access.'); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.75 });
      if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.75 });
    if (!r.canceled && r.assets[0]) setPhotoUri(r.assets[0].uri);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoUri) return null;
    setUploading(true);
    try {
      const token = await getAccessToken();
      const form = new FormData();
      form.append('file', { uri: photoUri, name: 'review.jpg', type: 'image/jpeg' } as unknown as Blob);
      const res = await fetch(`${getApiBaseUrl()}/api/v1/upload/document`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const body = await res.json() as { url?: string };
      return body.url ?? null;
    } finally {
      setUploading(false);
    }
  };

  const validate = () => {
    if (!stallId.trim()) { Alert.alert('Required', 'Enter a stall ID or number.'); return false; }
    if (!recommendation) { Alert.alert('Required', 'Select a recommendation before submitting.'); return false; }
    return true;
  };

  const handleSubmit = async (offline: boolean) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (!offline) {
        try { photoUrl = await uploadPhoto(); } catch { /* non-fatal */ }
      }
      const taskData = {
        stallId: stallId.trim(),
        productId: productId.trim() || undefined,
        ratings,
        averageRating: avgRating(),
        recommendation,
        notes: notes.trim(),
        photoUrl,
      };
      if (offline) {
        await enqueueTask('QUALITY_REVIEW', taskData);
        Alert.alert('Saved offline', 'Quality review queued — sync when you have signal.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await createTask('QUALITY_REVIEW', taskData, `local-${Date.now()}`);
        Alert.alert('Submitted', 'Quality review recorded.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Submission failed.';
      const tryOffline = await new Promise<boolean>((resolve) => {
        Alert.alert('Online failed', `${msg}\n\nSave offline instead?`, [
          { text: 'Save offline', onPress: () => resolve(true) },
          { text: 'Cancel', onPress: () => resolve(false) },
        ]);
      });
      if (tryOffline) await handleSubmit(true);
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || uploading;
  const avg = avgRating();

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <FontAwesome name="star" size={26} color="#fff" />
          <Text style={styles.heroTitle}>Quality review</Text>
          <Text style={styles.heroSub}>Rate a stall or product against Mall263 quality standards.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Stall & product</Text>
          <Text style={styles.label}>Stall ID / number *</Text>
          <TextInput style={styles.input} value={stallId} onChangeText={setStallId}
            placeholder="e.g. ST-042" autoCapitalize="characters" placeholderTextColor={Brand.muted} editable={!busy} />
          <Text style={styles.label}>Product ID (optional)</Text>
          <TextInput style={styles.input} value={productId} onChangeText={setProductId}
            placeholder="Leave blank for general stall review" placeholderTextColor={Brand.muted} editable={!busy} />
        </View>

        <View style={styles.card}>
          <View style={styles.ratingHeader}>
            <Text style={styles.sectionLabel}>Rating criteria</Text>
            {avg !== null && (
              <View style={styles.avgBadge}>
                <FontAwesome name="star" size={12} color={Brand.orange} />
                <Text style={styles.avgText}>{avg} avg</Text>
              </View>
            )}
          </View>
          {CRITERIA.map((c) => (
            <View key={c.key} style={styles.criterionBlock}>
              <Text style={styles.criterionLabel}>{c.label}</Text>
              <Text style={styles.criterionDesc}>{c.desc}</Text>
              <View style={styles.stars}>
                {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
                  <Pressable key={n} onPress={() => setRating(c.key, n)} hitSlop={6} disabled={busy}>
                    <FontAwesome
                      name={n <= (ratings[c.key] ?? 0) ? 'star' : 'star-o'}
                      size={28}
                      color={n <= (ratings[c.key] ?? 0) ? Brand.orange : Brand.border}
                    />
                  </Pressable>
                ))}
                {ratings[c.key] && (
                  <Text style={styles.starLabel}>
                    {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][ratings[c.key]]}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Recommendation</Text>
          <View style={styles.recRow}>
            {([
              { key: 'APPROVE', label: 'Approve', color: Brand.green, icon: 'check-circle' },
              { key: 'NEEDS_WORK', label: 'Needs work', color: Brand.orange, icon: 'exclamation-circle' },
              { key: 'REJECT', label: 'Reject', color: Brand.red, icon: 'times-circle' },
            ] as const).map((r) => (
              <Pressable
                key={r.key}
                style={[styles.recBtn, recommendation === r.key && { borderColor: r.color, backgroundColor: r.color + '15' }]}
                onPress={() => setRecommendation(r.key)}
                disabled={busy}
              >
                <FontAwesome name={r.icon} size={18} color={recommendation === r.key ? r.color : Brand.muted} />
                <Text style={[styles.recBtnText, recommendation === r.key && { color: r.color }]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Observations, specific issues, follow-up needed…"
            placeholderTextColor={Brand.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!busy}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Evidence photo</Text>
          {photoUri ? (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
              <Pressable onPress={pickPhoto} disabled={busy}>
                <Text style={styles.changePhoto}>Change photo</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.photoBox} onPress={pickPhoto} disabled={busy}>
              <FontAwesome name="camera" size={24} color={Brand.muted} />
              <Text style={styles.photoHint}>Tap to take or pick photo</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => handleSubmit(false)}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit review (online)</Text>}
        </Pressable>
        <Pressable
          style={[styles.outlineBtn, busy && styles.btnDisabled]}
          onPress={() => handleSubmit(true)}
          disabled={busy}
        >
          <Text style={styles.outlineBtnText}>Save offline (no signal)</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },

  hero: {
    backgroundColor: Brand.orange,
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  label: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: Brand.pageBg,
  },
  textarea: { height: 100, paddingTop: 12 },

  ratingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7ed',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  avgText: { fontSize: 13, fontWeight: '800', color: Brand.orange },

  criterionBlock: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
    gap: 4,
  },
  criterionLabel: { fontSize: 14, fontWeight: '800', color: Brand.navy },
  criterionDesc: { fontSize: 12, color: Brand.muted, lineHeight: 17 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  starLabel: { fontSize: 12, fontWeight: '700', color: Brand.orange, marginLeft: 4 },

  recRow: { flexDirection: 'row', gap: 10 },
  recBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.pageBg,
  },
  recBtnText: { fontSize: 12, fontWeight: '800', color: Brand.muted },

  photo: { width: '100%', height: 200, borderRadius: 12 },
  changePhoto: { color: Brand.blue, fontWeight: '700', fontSize: 13 },
  photoBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    gap: 8,
  },
  photoHint: { color: Brand.muted, fontWeight: '700', fontSize: 13 },

  primaryBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  outlineBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
