import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { displayCity, fetchMalls, submitMerchantSetup, type Mall } from '@/lib/stalls-api';
import { Brand } from '@/constants/brand';

export default function SellerSetupScreen() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [stallName, setStallName] = useState('');
  const [stallNumber, setStallNumber] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [selectedMall, setSelectedMall] = useState<Mall | null>(null);
  const [mallPickerOpen, setMallPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mallsQ = useQuery({
    queryKey: ['malls'],
    queryFn: () => fetchMalls(),
    staleTime: 60_000,
  });

  const selectedMallCity = selectedMall ? displayCity(selectedMall.city) : '';
  const selectedMallDisplay = selectedMall
    ? `${selectedMall.name}${selectedMallCity ? ` — ${selectedMallCity}` : ''}`
    : null;

  const onSubmit = async () => {
    if (!businessName.trim()) return Alert.alert('Missing business name', 'Enter your business name.');
    if (!stallName.trim()) return Alert.alert('Missing stall name', 'Name your first stall / storefront.');
    if (!stallNumber.trim()) return Alert.alert('Missing stall number', 'Enter your stall number or unit identifier.');

    setSubmitting(true);
    try {
      await submitMerchantSetup({
        businessName: businessName.trim(),
        businessPhone: businessPhone.trim() || undefined,
        stallName: stallName.trim(),
        stallNumber: stallNumber.trim(),
        mallId: selectedMall?.id,
        description: description.trim() || undefined,
        address: address.trim() || undefined,
      });
      Alert.alert('Setup complete', 'Your stall is ready. Start adding products!', [
        { text: 'Go to Seller Hub', onPress: () => router.replace('/seller') },
      ]);
    } catch (err) {
      let msg = 'Could not complete setup. Please try again.';
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string | string[] } | undefined;
        const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        if (m) msg = m;
      }
      Alert.alert('Setup failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <FontAwesome name="briefcase" size={22} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Open your stall</Text>
          <Text style={styles.heroSub}>
            Tell us about your business. You can edit everything later.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Business</Text>

          <Text style={styles.label}>Business name</Text>
          <TextInput
            style={styles.input}
            placeholder="Moyo Electronics"
            placeholderTextColor="#9ca3af"
            value={businessName}
            onChangeText={setBusinessName}
            editable={!submitting}
          />

          <Text style={styles.label}>Business phone (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="+263771234567"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            value={businessPhone}
            onChangeText={setBusinessPhone}
            editable={!submitting}
          />

          <View style={styles.hr} />
          <Text style={styles.section}>First stall</Text>

          <Text style={styles.label}>Stall / store name</Text>
          <TextInput
            style={styles.input}
            placeholder="Moyo Electronics — Rusike"
            placeholderTextColor="#9ca3af"
            value={stallName}
            onChangeText={setStallName}
            editable={!submitting}
          />

          <Text style={styles.label}>Stall number / unit</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. B12"
            placeholderTextColor="#9ca3af"
            value={stallNumber}
            onChangeText={setStallNumber}
            editable={!submitting}
          />

          <Text style={styles.label}>Mall (optional)</Text>
          <Pressable
            style={styles.picker}
            onPress={() => setMallPickerOpen(true)}
            disabled={submitting || mallsQ.isLoading}
          >
            <Text style={[styles.pickerText, !selectedMall && styles.pickerPlaceholder]}>
              {selectedMallDisplay ?? 'Select a mall'}
            </Text>
            <FontAwesome name="chevron-down" size={12} color={Brand.muted} />
          </Pressable>
          {mallsQ.isError ? (
            <Text style={styles.hint}>Could not load malls — you can skip this for now.</Text>
          ) : null}

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="What do you sell? What makes your stall special?"
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            editable={!submitting}
          />

          <Text style={styles.label}>Address (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Street, suburb, city"
            placeholderTextColor="#9ca3af"
            value={address}
            onChangeText={setAddress}
            editable={!submitting}
          />

          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="check" size={14} color="#fff" />
                <Text style={styles.submitBtnText}>Create my stall</Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={mallPickerOpen} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setMallPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Pick your mall</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <Pressable
                style={styles.mallRow}
                onPress={() => {
                  setSelectedMall(null);
                  setMallPickerOpen(false);
                }}
              >
                <Text style={styles.mallRowText}>No mall / independent</Text>
                {!selectedMall ? <FontAwesome name="check" size={14} color={Brand.blue} /> : null}
              </Pressable>
              {(mallsQ.data ?? []).map((m) => {
                const cityLabel = displayCity(m.city);
                return (
                <Pressable
                  key={m.id}
                  style={styles.mallRow}
                  onPress={() => {
                    setSelectedMall(m);
                    setMallPickerOpen(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mallRowText}>{m.name}</Text>
                    {cityLabel ? <Text style={styles.mallRowSub}>{cityLabel}</Text> : null}
                  </View>
                  {selectedMall?.id === m.id ? <FontAwesome name="check" size={14} color={Brand.blue} /> : null}
                </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setMallPickerOpen(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 48 },

  hero: {
    backgroundColor: Brand.navy,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: '#ffffffcc', fontSize: 13, marginTop: 4, lineHeight: 18 },

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
    marginBottom: 8,
  },
  label: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: '#fafbfd',
  },
  textarea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 10 },
  hint: { fontSize: 11, color: Brand.muted, marginTop: 6 },

  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#fafbfd',
  },
  pickerText: { flex: 1, fontSize: 15, color: Brand.text },
  pickerPlaceholder: { color: '#9ca3af' },

  hr: { height: 1, backgroundColor: Brand.border, marginVertical: 18 },

  submitBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { color: Brand.muted, fontSize: 13, fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 28,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Brand.navy, marginBottom: 12 },
  mallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
    gap: 10,
  },
  mallRowText: { fontSize: 15, color: Brand.text, fontWeight: '600' },
  mallRowSub: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  closeBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  closeBtnText: { color: Brand.navy, fontWeight: '800' },
});
