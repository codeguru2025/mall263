import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Brand } from '@/constants/brand';
import { createTask } from '@/lib/agent-api';
import { enqueueTask } from '@/lib/agent-queue';
import { uploadImage } from '@/lib/seller-api';

export default function CaptureScreen() {
  const [stallId, setStallId] = useState('');
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to capture a product image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setUploadingImage(true);
    try {
      const url = await uploadImage(asset.uri, asset.mimeType ?? 'image/jpeg');
      setImageUrl(url);
    } catch {
      Alert.alert('Upload failed', 'Image could not be uploaded. You can still save the task offline.');
      setImageUri(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const buildPayload = () => ({
    stallId: stallId.trim(),
    productName: productName.trim(),
    description: description.trim() || undefined,
    sellingPrice: parseFloat(price) || 0,
    stockQuantity: parseInt(stock, 10) || 0,
    imageUrl: imageUrl ?? undefined,
  });

  const validate = () => {
    if (!stallId.trim()) { Alert.alert('Required', 'Enter the stall ID.'); return false; }
    if (!productName.trim()) { Alert.alert('Required', 'Enter the product name.'); return false; }
    if (!price || parseFloat(price) <= 0) { Alert.alert('Required', 'Enter a valid price.'); return false; }
    return true;
  };

  const handleSubmit = async (offline: boolean) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (offline) {
        await enqueueTask('PRODUCT_CAPTURE', payload);
        Alert.alert('Saved offline', 'Queued. Will sync when you have signal.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const offlineId = `local-${Date.now()}`;
        await createTask('PRODUCT_CAPTURE', payload, offlineId);
        Alert.alert('Submitted', 'Product capture task created.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      if (offline) { Alert.alert('Error', 'Could not save locally.'); return; }
      const msg = err?.response?.data?.message || 'Submission failed.';
      const tryOffline = await new Promise<boolean>((resolve) => {
        Alert.alert('Online submit failed', `${msg}\n\nSave offline instead?`, [
          { text: 'Save offline', onPress: () => resolve(true) },
          { text: 'Cancel', onPress: () => resolve(false) },
        ]);
      });
      if (tryOffline) await handleSubmit(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Photo */}
        <Pressable style={styles.imagePicker} onPress={pickImage} disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator color={Brand.blue} />
          ) : imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to capture photo</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.label}>Stall ID *</Text>
          <TextInput style={styles.input} value={stallId} onChangeText={setStallId} placeholder="Paste stall UUID" placeholderTextColor={Brand.muted} autoCapitalize="none" />

          <Text style={styles.label}>Product name *</Text>
          <TextInput style={styles.input} value={productName} onChangeText={setProductName} placeholder="e.g. Men's leather belt" placeholderTextColor={Brand.muted} />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional details…"
            placeholderTextColor={Brand.muted}
            multiline
            numberOfLines={3}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Price (USD) *</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={Brand.muted} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Stock qty</Text>
              <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="0" keyboardType="number-pad" placeholderTextColor={Brand.muted} />
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.submitBtn, (submitting || uploadingImage) && styles.btnDisabled]}
          onPress={() => handleSubmit(false)}
          disabled={submitting || uploadingImage}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit (online)</Text>}
        </Pressable>

        <Pressable
          style={[styles.offlineBtn, (submitting || uploadingImage) && styles.btnDisabled]}
          onPress={() => handleSubmit(true)}
          disabled={submitting || uploadingImage}
        >
          <Text style={styles.offlineBtnText}>Save offline (no signal)</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 48 },

  imagePicker: {
    height: 150, borderRadius: 14, overflow: 'hidden', marginBottom: 16,
    backgroundColor: Brand.border, borderWidth: 2, borderStyle: 'dashed',
    borderColor: Brand.blue, justifyContent: 'center', alignItems: 'center',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', gap: 6 },
  imagePlaceholderIcon: { fontSize: 28 },
  imagePlaceholderText: { fontSize: 13, color: Brand.blue, fontWeight: '700' },

  card: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 16,
  },
  label: { fontSize: 12, fontWeight: '700', color: Brand.muted, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: Brand.text, backgroundColor: Brand.pageBg,
  },
  multiline: { minHeight: 68, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },

  submitBtn: { backgroundColor: Brand.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  offlineBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.card,
  },
  offlineBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
