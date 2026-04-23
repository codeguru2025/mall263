import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { createProduct, uploadImage, fetchCategories, type Category } from '@/lib/seller-api';

type VariantRow = {
  name: string;
  sellingPrice: string;
  costPrice: string;
  stock: string;
};

type ImageEntry = {
  localUri: string;
  cdnUrl: string | null;
  uploading: boolean;
};

function newVariant(): VariantRow {
  return { name: '', sellingPrice: '', costPrice: '', stock: '' };
}

export default function NewProductScreen() {
  const { stallId } = useLocalSearchParams<{ stallId: string }>();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([{ name: 'Standard', sellingPrice: '', costPrice: '', stock: '' }]);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const categoriesQ = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const categories: Category[] = categoriesQ.data ?? [];
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to add product images.');
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
    const entry: ImageEntry = { localUri: asset.uri, cdnUrl: null, uploading: true };
    setImages((prev) => [...prev, entry]);
    const idx = images.length;
    try {
      const url = await uploadImage(asset.uri, asset.mimeType ?? 'image/jpeg');
      setImages((prev) => prev.map((e, i) => i === idx ? { ...e, cdnUrl: url, uploading: false } : e));
    } catch {
      Alert.alert('Upload failed', 'Could not upload image. Try again.');
      setImages((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx: number, field: keyof VariantRow, value: string) => {
    setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const addVariant = () => setVariants((prev) => [...prev, newVariant()]);

  const removeVariant = (idx: number) => {
    if (variants.length === 1) return;
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Product name is required.'); return; }
    if (!stallId) { Alert.alert('Error', 'Missing stall context.'); return; }

    const parsedVariants = variants.map((v, i) => {
      const sp = parseFloat(v.sellingPrice);
      const cp = parseFloat(v.costPrice);
      const sq = parseInt(v.stock, 10);
      if (!sp || sp <= 0) throw new Error(`Variant ${i + 1}: enter a valid selling price.`);
      if (isNaN(cp) || cp < 0) throw new Error(`Variant ${i + 1}: enter a valid cost price.`);
      if (isNaN(sq) || sq < 0) throw new Error(`Variant ${i + 1}: enter a valid stock quantity.`);
      return { name: v.name.trim() || `Variant ${i + 1}`, sellingPrice: sp, costPrice: cp, stockQuantity: sq };
    });

    try {
      parsedVariants; // trigger throws above
    } catch (err: any) {
      Alert.alert('Invalid input', err.message);
      return;
    }

    if (images.some((e) => e.uploading)) {
      Alert.alert('Please wait', 'Images are still uploading.');
      return;
    }

    setSubmitting(true);
    try {
      await createProduct({
        stallId,
        name: name.trim(),
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        categoryId: categoryId ?? undefined,
        variants: parsedVariants,
        images: images
          .filter((e) => !!e.cdnUrl)
          .map((e, i) => ({ url: e.cdnUrl!, isPrimary: i === 0 })),
      });
      Alert.alert('Done', 'Product created.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Could not create product.';
      Alert.alert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isUploading = images.some((e) => e.uploading);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Images row */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <View style={styles.imagesRow}>
          {images.map((entry, idx) => (
            <View key={idx} style={styles.imageTile}>
              {entry.uploading ? (
                <View style={[styles.imageTile, styles.imageTileLoading]}>
                  <ActivityIndicator color={Brand.blue} />
                </View>
              ) : (
                <Image source={{ uri: entry.localUri }} style={styles.imageTileImg} contentFit="cover" />
              )}
              <Pressable style={styles.imageRemoveBtn} onPress={() => removeImage(idx)}>
                <FontAwesome name="times" size={12} color="#fff" />
              </Pressable>
              {idx === 0 && <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Primary</Text></View>}
            </View>
          ))}
          {images.length < 6 && (
            <Pressable style={styles.addImageBtn} onPress={pickImage} disabled={isUploading}>
              <FontAwesome name="camera" size={22} color={Brand.blue} />
              <Text style={styles.addImageText}>Add photo</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionTitle}>Product details</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Men's T-Shirt"
            placeholderTextColor={Brand.muted}
          />

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
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Adidas"
            placeholderTextColor={Brand.muted}
          />

          <Text style={styles.label}>Category</Text>
          <Pressable
            style={[styles.input, styles.selectInput]}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Text style={selectedCategory ? styles.selectText : styles.selectPlaceholder}>
              {selectedCategory?.name ?? 'Select category (optional)'}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={Brand.muted} />
          </Pressable>
        </View>

        <View style={styles.variantsHeader}>
          <Text style={styles.sectionTitle}>Variants & pricing</Text>
          <Pressable style={styles.addVariantBtn} onPress={addVariant}>
            <FontAwesome name="plus" size={12} color={Brand.blue} />
            <Text style={styles.addVariantText}>Add variant</Text>
          </Pressable>
        </View>

        {variants.map((v, idx) => (
          <View key={idx} style={styles.variantCard}>
            <View style={styles.variantCardHeader}>
              <Text style={styles.variantNum}>Variant {idx + 1}</Text>
              {variants.length > 1 && (
                <Pressable onPress={() => removeVariant(idx)} hitSlop={8}>
                  <FontAwesome name="trash" size={14} color={Brand.red} />
                </Pressable>
              )}
            </View>
            <Text style={styles.label}>Variant name</Text>
            <TextInput
              style={styles.input}
              value={v.name}
              onChangeText={(val: string) => updateVariant(idx, 'name', val)}
              placeholder={idx === 0 ? 'Standard' : `e.g. Size L, Red`}
              placeholderTextColor={Brand.muted}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Selling price *</Text>
                <TextInput
                  style={styles.input}
                  value={v.sellingPrice}
                  onChangeText={(val: string) => updateVariant(idx, 'sellingPrice', val)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={Brand.muted}
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cost price *</Text>
                <TextInput
                  style={styles.input}
                  value={v.costPrice}
                  onChangeText={(val: string) => updateVariant(idx, 'costPrice', val)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor={Brand.muted}
                />
              </View>
            </View>
            <Text style={styles.label}>Opening stock *</Text>
            <TextInput
              style={styles.input}
              value={v.stock}
              onChangeText={(val: string) => updateVariant(idx, 'stock', val)}
              placeholder="0"
              keyboardType="number-pad"
              placeholderTextColor={Brand.muted}
            />
          </View>
        ))}

        <Pressable
          style={[styles.submitBtn, (submitting || isUploading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || isUploading}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create product</Text>}
        </Pressable>
      </ScrollView>

      {/* Category picker modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryPicker(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            {categoriesQ.isPending ? (
              <ActivityIndicator color={Brand.blue} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={[{ id: '', name: 'None' }, ...categories]}
                keyExtractor={(item: { id: string; name: string }) => item.id}
                renderItem={({ item }: { item: { id: string; name: string } }) => (
                  <Pressable
                    style={[styles.categoryItem, item.id === (categoryId ?? '') && styles.categoryItemActive]}
                    onPress={() => { setCategoryId(item.id || null); setShowCategoryPicker(false); }}
                  >
                    <Text style={[styles.categoryItemText, item.id === (categoryId ?? '') && styles.categoryItemTextActive]}>
                      {item.name}
                    </Text>
                    {item.id === (categoryId ?? '') && <FontAwesome name="check" size={14} color={Brand.blue} />}
                  </Pressable>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 16, paddingBottom: 48 },

  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: Brand.muted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
  },

  imagesRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16,
  },
  imageTile: {
    width: 90, height: 90, borderRadius: 12, overflow: 'hidden',
    backgroundColor: Brand.border, position: 'relative',
  },
  imageTileLoading: { justifyContent: 'center', alignItems: 'center' },
  imageTileImg: { width: '100%', height: '100%' },
  imageRemoveBtn: {
    position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12, width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
  },
  primaryBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(59,154,225,0.85)', paddingVertical: 2, alignItems: 'center',
  },
  primaryBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  addImageBtn: {
    width: 90, height: 90, borderRadius: 12,
    borderWidth: 2, borderStyle: 'dashed', borderColor: Brand.blue,
    justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: '#f0f7ff',
  },
  addImageText: { fontSize: 10, color: Brand.blue, fontWeight: '700' },

  card: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 16, gap: 2,
  },
  label: { fontSize: 12, fontWeight: '700', color: Brand.muted, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: Brand.text, backgroundColor: Brand.pageBg,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  selectInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectText: { fontSize: 15, color: Brand.text, flex: 1 },
  selectPlaceholder: { fontSize: 15, color: Brand.muted, flex: 1 },
  row: { flexDirection: 'row' },

  variantsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  addVariantBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1.5, borderColor: Brand.blue, backgroundColor: '#f0f7ff',
  },
  addVariantText: { color: Brand.blue, fontWeight: '700', fontSize: 13 },

  variantCard: {
    backgroundColor: Brand.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Brand.border, marginBottom: 10,
  },
  variantCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  variantNum: { fontSize: 13, fontWeight: '800', color: Brand.navy },

  submitBtn: {
    backgroundColor: Brand.blue, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Brand.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', paddingBottom: 32,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Brand.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '800', color: Brand.navy,
    paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  categoryItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Brand.border,
  },
  categoryItemActive: { backgroundColor: '#f0f7ff' },
  categoryItemText: { fontSize: 15, color: Brand.text },
  categoryItemTextActive: { color: Brand.blue, fontWeight: '700' },
});
