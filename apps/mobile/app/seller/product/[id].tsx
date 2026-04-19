import { useEffect, useState } from 'react';
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
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import {
  fetchProductsByStall,
  updateProduct,
  updateVariant,
  adjustStock,
  uploadImage,
  type Product,
  type ProductVariant,
} from '@/lib/seller-api';
import { formatMoney } from '@/lib/products';

const STATUS_OPTIONS = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

export default function EditProductScreen() {
  const { id, stallId } = useLocalSearchParams<{ id: string; stallId: string }>();
  const qc = useQueryClient();

  const productsQ = useQuery({
    queryKey: ['stall-products', stallId],
    queryFn: () => fetchProductsByStall(stallId!),
    enabled: !!stallId,
  });

  const product: Product | undefined = productsQ.data?.data.find((p) => p.id === id);

  // Product fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [savingProduct, setSavingProduct] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Stock adjust
  const [adjustVariantId, setAdjustVariantId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description ?? '');
      setBrand(product.brand ?? '');
      setStatus(product.status);
    }
  }, [product]);

  const pickAndUploadImage = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to change the product image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.92,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setImageUri(asset.uri);
    setUploadingImage(true);
    try {
      const url = await uploadImage(asset.uri, asset.mimeType ?? 'image/jpeg');
      await updateProduct(id!, stallId!, { images: [{ url, isPrimary: true }] });
      await qc.invalidateQueries({ queryKey: ['stall-products', stallId] });
      Alert.alert('Done', 'Product image updated.');
    } catch {
      Alert.alert('Upload failed', 'Could not update image. Try again.');
      setImageUri(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Product name is required.'); return; }
    if (!id || !stallId) return;
    setSavingProduct(true);
    try {
      await updateProduct(id, stallId, { name: name.trim(), description: description.trim() || undefined, brand: brand.trim() || undefined, status });
      await qc.invalidateQueries({ queryKey: ['stall-products', stallId] });
      Alert.alert('Saved', 'Product updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not update product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustVariantId) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty === 0) { Alert.alert('Invalid', 'Enter a non-zero quantity (e.g. +5 or -3).'); return; }
    if (!adjustReason.trim()) { Alert.alert('Required', 'Enter a reason for the adjustment.'); return; }
    setAdjusting(true);
    try {
      await adjustStock(adjustVariantId, qty, adjustReason.trim());
      await qc.invalidateQueries({ queryKey: ['stall-products', stallId] });
      setAdjustVariantId(null);
      setAdjustQty('');
      setAdjustReason('');
      Alert.alert('Done', `Stock adjusted by ${qty > 0 ? '+' : ''}${qty}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not adjust stock.');
    } finally {
      setAdjusting(false);
    }
  };

  if (productsQ.isPending) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={Brand.blue} /></View>;
  }

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Product not found.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const variants = product.variants ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Image */}
        <Pressable style={styles.imagePicker} onPress={pickAndUploadImage} disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator color={Brand.blue} />
          ) : (imageUri ?? product.images?.[0]?.url) ? (
            <Image
              source={{ uri: imageUri ?? product.images?.[0]?.url }}
              style={styles.imagePreview}
              contentFit="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <FontAwesome name="camera" size={22} color={Brand.muted} />
              <Text style={styles.imagePlaceholderText}>Tap to change photo</Text>
            </View>
          )}
        </Pressable>

        {/* Product edit form */}
        <Text style={styles.sectionTitle}>Product details</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={Brand.muted} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholderTextColor={Brand.muted} />

          <Text style={styles.label}>Brand</Text>
          <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholderTextColor={Brand.muted} />

          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((s) => (
              <Pressable
                key={s}
                style={[styles.statusBtn, status === s && styles.statusBtnActive]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.statusBtnText, status === s && styles.statusBtnTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.saveBtn, savingProduct && styles.btnDisabled]}
            onPress={handleSaveProduct}
            disabled={savingProduct}
          >
            {savingProduct ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
          </Pressable>
        </View>

        {/* Variants & stock */}
        <Text style={styles.sectionTitle}>Variants & stock</Text>
        {variants.map((v: ProductVariant) => (
          <View key={v.id} style={[styles.card, styles.variantCard]}>
            <View style={styles.variantHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.variantName}>{v.name}</Text>
                {v.color && <Text style={styles.variantMeta}>Colour: {v.color}</Text>}
                {v.size && <Text style={styles.variantMeta}>Size: {v.size}</Text>}
              </View>
              <View style={styles.variantPrices}>
                <Text style={styles.variantPrice}>{formatMoney(v.sellingPrice, 'USD')}</Text>
                <Text style={styles.variantCost}>Cost: {formatMoney(v.costPrice, 'USD')}</Text>
              </View>
            </View>

            <View style={styles.stockRow}>
              <View style={styles.stockStats}>
                <View style={styles.stockStat}>
                  <Text style={styles.stockStatValue}>{v.inventory?.quantity ?? 0}</Text>
                  <Text style={styles.stockStatLabel}>In stock</Text>
                </View>
                <View style={styles.stockStatDivider} />
                <View style={styles.stockStat}>
                  <Text style={[styles.stockStatValue, { color: Brand.blue }]}>{v._count?.posSaleItems ?? 0}</Text>
                  <Text style={styles.stockStatLabel}>Sold (POS)</Text>
                </View>
                {(v.inventory?.lowStockThreshold != null) && (v.inventory?.quantity ?? 0) <= v.inventory.lowStockThreshold && (
                  <>
                    <View style={styles.stockStatDivider} />
                    <View style={styles.stockStat}>
                      <Text style={[styles.stockStatValue, { color: Brand.red ?? '#ef4444' }]}>Low</Text>
                      <Text style={styles.stockStatLabel}>Stock alert</Text>
                    </View>
                  </>
                )}
              </View>
              <Pressable
                style={styles.adjustTrigger}
                onPress={() => setAdjustVariantId(adjustVariantId === v.id ? null : v.id)}
              >
                <Text style={styles.adjustTriggerText}>Adjust</Text>
              </Pressable>
            </View>

            {/* Inline stock adjust form */}
            {adjustVariantId === v.id && (
              <View style={styles.adjustForm}>
                <Text style={styles.label}>Change qty (+ to add, - to remove)</Text>
                <TextInput
                  style={styles.input}
                  value={adjustQty}
                  onChangeText={setAdjustQty}
                  placeholder="+10 or -3"
                  keyboardType="numbers-and-punctuation"
                  placeholderTextColor={Brand.muted}
                />
                <Text style={styles.label}>Reason *</Text>
                <TextInput
                  style={styles.input}
                  value={adjustReason}
                  onChangeText={setAdjustReason}
                  placeholder="e.g. Stock received, damaged goods"
                  placeholderTextColor={Brand.muted}
                />
                <Pressable
                  style={[styles.saveBtn, adjusting && styles.btnDisabled]}
                  onPress={handleAdjustStock}
                  disabled={adjusting}
                >
                  {adjusting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirm adjustment</Text>}
                </Pressable>
              </View>
            )}
          </View>
        ))}

        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back to products</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Brand.pageBg },
  errorText: { fontSize: 15, fontWeight: '700', color: Brand.red },

  imagePicker: {
    width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: Brand.card,
    borderWidth: 1, borderColor: Brand.border, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', gap: 8 },
  imagePlaceholderText: { fontSize: 13, color: Brand.muted, fontWeight: '600' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: Brand.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Brand.border, marginBottom: 14 },
  variantCard: { gap: 8 },

  label: { fontSize: 12, fontWeight: '700', color: Brand.muted, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Brand.text, backgroundColor: Brand.pageBg,
  },
  multiline: { minHeight: 68, textAlignVertical: 'top' },

  statusRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statusBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Brand.border, alignItems: 'center' },
  statusBtnActive: { backgroundColor: Brand.navy, borderColor: Brand.navy },
  statusBtnText: { fontSize: 11, fontWeight: '800', color: Brand.muted },
  statusBtnTextActive: { color: '#fff' },

  saveBtn: { backgroundColor: Brand.blue, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },

  variantHeader: { flexDirection: 'row', gap: 12 },
  variantName: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  variantMeta: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  variantPrices: { alignItems: 'flex-end' },
  variantPrice: { fontSize: 15, fontWeight: '900', color: Brand.navy },
  variantCost: { fontSize: 11, color: Brand.muted },

  stockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  stockStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stockStat: { alignItems: 'center' },
  stockStatValue: { fontSize: 18, fontWeight: '900', color: Brand.navy },
  stockStatLabel: { fontSize: 10, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  stockStatDivider: { width: 1, height: 24, backgroundColor: Brand.border },
  adjustTrigger: { backgroundColor: Brand.blue, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  adjustTriggerText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  adjustForm: { borderTopWidth: 1, borderTopColor: Brand.border, paddingTop: 10, gap: 2 },

  backBtn: { marginTop: 8, alignItems: 'center', paddingVertical: 12 },
  backBtnText: { color: Brand.blue, fontWeight: '700', fontSize: 14 },
});
