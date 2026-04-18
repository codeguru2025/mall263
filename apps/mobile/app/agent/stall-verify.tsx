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

const CHECKS = [
  'Stall is physically present and accessible',
  'Products match what was registered in the system',
  'Stall number/signage is visible and correct',
  'Merchant is contactable and aware of the visit',
  'Payment terminal / POS is operational',
];

export default function StallVerifyScreen() {
  const [stallId, setStallId] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleCheck = (i: number) =>
    setChecks((prev) => ({ ...prev, [i]: !prev[i] }));

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow photo access to upload a stall image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow camera access to take a stall photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoUri) return null;
    setUploading(true);
    try {
      const token = await getAccessToken();
      const form = new FormData();
      form.append('file', { uri: photoUri, name: 'stall.jpg', type: 'image/jpeg' } as unknown as Blob);
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
    if (!stallId.trim()) { Alert.alert('Required', 'Enter the stall ID or number.'); return false; }
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
        notes: notes.trim(),
        photoUrl,
        checks: CHECKS.reduce<Record<string, boolean>>((acc, label, i) => {
          acc[label] = !!checks[i];
          return acc;
        }, {}),
      };
      if (offline) {
        await enqueueTask('STALL_VERIFICATION', taskData);
        Alert.alert('Saved offline', 'Verification queued — sync when you have signal.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const offlineId = `local-${Date.now()}`;
        await createTask('STALL_VERIFICATION', taskData, offlineId);
        Alert.alert('Submitted', 'Stall verification task created.', [
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

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <FontAwesome name="check-square-o" size={26} color="#fff" />
          <Text style={styles.heroTitle}>Stall verification</Text>
          <Text style={styles.heroSub}>Physically inspect the stall and record what you find.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Stall details</Text>
          <Text style={styles.label}>Stall ID or number *</Text>
          <TextInput
            style={styles.input}
            value={stallId}
            onChangeText={setStallId}
            placeholder="e.g. ST-042 or A12"
            placeholderTextColor={Brand.muted}
            autoCapitalize="characters"
            editable={!busy}
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Observations, issues, follow-up needed…"
            placeholderTextColor={Brand.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!busy}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Checklist</Text>
          {CHECKS.map((label, i) => (
            <Pressable
              key={i}
              style={styles.checkRow}
              onPress={() => toggleCheck(i)}
              disabled={busy}
            >
              <View style={[styles.checkbox, checks[i] && styles.checkboxActive]}>
                {checks[i] ? <FontAwesome name="check" size={11} color="#fff" /> : null}
              </View>
              <Text style={styles.checkLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Stall photo</Text>
          {photoUri ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
              <Pressable style={styles.changePhotoBtn} onPress={pickPhoto}>
                <Text style={styles.changePhotoBtnText}>Change photo</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoActions}>
              <Pressable style={styles.photoBtn} onPress={takePhoto} disabled={busy}>
                <FontAwesome name="camera" size={16} color={Brand.blue} />
                <Text style={styles.photoBtnText}>Camera</Text>
              </Pressable>
              <Pressable style={styles.photoBtn} onPress={pickPhoto} disabled={busy}>
                <FontAwesome name="image" size={16} color={Brand.blue} />
                <Text style={styles.photoBtnText}>Gallery</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => handleSubmit(false)}
          disabled={busy}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Submit (online)</Text>}
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
    gap: 10,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },

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

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxActive: { backgroundColor: Brand.green, borderColor: Brand.green },
  checkLabel: { flex: 1, fontSize: 14, color: Brand.navy, lineHeight: 20 },

  photoWrap: { alignItems: 'center', gap: 10 },
  photo: { width: '100%', height: 200, borderRadius: 12 },
  changePhotoBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  changePhotoBtnText: { color: Brand.blue, fontWeight: '700' },
  photoActions: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.border,
    borderRadius: 12,
    paddingVertical: 22,
  },
  photoBtnText: { fontSize: 14, fontWeight: '700', color: Brand.blue },

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
