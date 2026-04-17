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
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { createProduct, uploadImage, fetchCategories } from '@/lib/seller-api';

export default function NewProductScreen() {
  const { stallId } = useLocalSearchParams<{ stallId: string }>();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [variantName, setVariantName] = useState('Standard');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const categoriesQ = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to add a product image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
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
      Alert.alert('Upload failed', 'Could not upload image. You can add one later.');
      setImageUri(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Product name is required.'); return; }
    const sp = parseFloat(sellingPrice);
    const cp = parseFloat(costPrice);
    const sq = parseInt(stock, 10);
    if (!sp || sp <= 0) { Alert.alert('Required', 'Enter a valid selling price.'); return; }
    if (!cp || cp < 0) { Alert.alert('Required', 'Enter a valid cost price.'); return; }
    if (isNaN(sq) || sq < 0) { Alert.alert('Required', 'Enter a valid opening stock.'); return; }
    if (!stallId) { Alert.alert('Error', 'Missing stall context.'); return; }

    setSubmitting(true);
    try {
      await createProduct({
        stallId,
        name: name.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        variants: [{ name: variantName.trim() || 'Standard', sellingPrice: sp, costPrice: cp, stockQuantity: sq }],
        images: imageUrl ? [{ url: imageUrl, isPrimary: true }] : undefined,
      });
      Alert.alert('Done', 'Product created.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not create product.';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Image picker */}
        <Pressable style={styles.imagePicker} onPress={pickImage} disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator color={Brand.blue} />
          ) : imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>Product details</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Men's T-Shirt" placeholderTextColor={Brand.muted} />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the product..."
            placeholderTextColor={Brand.muted}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Brand</Text>
          <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="e.g. Adidas" placeholderTextColor={Brand.muted} />
        </View>

        <Text style={styles.sectionTitle}>Variant & pricing</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Variant name</Text>
          <TextInput style={styles.input} value={variantName} onChangeText={setVariantName} placeholder="Standard" placeholderTextColor={Brand.muted} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Selling price (USD) *</Text>
              <TextInput style={styles.input} value={sellingPrice} onChangeText={setSellingPrice} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={Brand.muted} />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Cost price (USD) *</Text>
              <TextInput style={styles.input} value={costPrice} onChangeText={setCostPrice} placeholder="0.00" keyboardType="decimal-pad" placeholderTextColor={Brand.muted} />
            </View>
          </View>

          <Text style={styles.label}>Opening stock *</Text>
          <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="0" keyboardType="number-pad" placeholderTextColor={Brand.muted} />
        </View>

        <Pressable
          style={[styles.submitBtn, (submitting || uploadingImage) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || uploadingImage}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create product</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 48 },

  imagePicker: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: Brand.border,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Brand.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', gap: 6 },
  imagePlaceholderIcon: { fontSize: 32 },
  imagePlaceholderText: { fontSize: 13, color: Brand.blue, fontWeight: '700' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 16,
    gap: 2,
  },
  label: { fontSize: 12, fontWeight: '700', color: Brand.muted, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: Brand.pageBg,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },

  submitBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
