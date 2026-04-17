import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Brand } from '@/constants/brand';
import { searchOnboardingCandidates, createTask, type OnboardingCandidate } from '@/lib/agent-api';
import { enqueueTask } from '@/lib/agent-queue';

type Step = 'search' | 'form';

export default function OnboardScreen() {
  const [step, setStep] = useState<Step>('search');
  const [searchQ, setSearchQ] = useState('');
  const [candidates, setCandidates] = useState<OnboardingCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const [selected, setSelected] = useState<OnboardingCandidate | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = useCallback(async () => {
    const digits = searchQ.replace(/\D/g, '');
    if (digits.length < 5) {
      Alert.alert('Too short', 'Enter at least 5 digits of the seller phone number.');
      return;
    }
    setSearching(true);
    try {
      const result = await searchOnboardingCandidates(digits);
      setCandidates(result.data);
      if (result.data.length === 0) {
        Alert.alert('No results', 'No buyers found with that number. They may already be a merchant.');
      }
    } catch {
      Alert.alert('Search failed', 'Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  }, [searchQ]);

  const selectCandidate = (c: OnboardingCandidate) => {
    setSelected(c);
    setBusinessPhone(c.phone);
    setStep('form');
  };

  const handleSubmit = async (offline: boolean) => {
    if (!selected) return;
    if (!businessName.trim()) { Alert.alert('Required', 'Enter a business name.'); return; }

    const taskData = {
      userId: selected.id,
      businessName: businessName.trim(),
      businessPhone: businessPhone.trim() || selected.phone,
    };

    setSubmitting(true);
    try {
      if (offline) {
        await enqueueTask('MERCHANT_ONBOARDING', taskData);
        Alert.alert('Saved offline', 'Task queued. It will sync when you have signal.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const offlineId = `local-${Date.now()}`;
        await createTask('MERCHANT_ONBOARDING', taskData, offlineId);
        Alert.alert('Submitted', `Onboarding task created for ${selected.firstName} ${selected.lastName}.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      if (offline) throw err;
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

  // ── Search step ─────────────────────────────────────────────────────────────

  if (step === 'search') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text style={styles.intro}>Find a buyer to onboard as a merchant. Enter at least 5 digits of their phone number.</Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQ}
              onChangeText={setSearchQ}
              placeholder="+263771234567 or digits"
              keyboardType="phone-pad"
              placeholderTextColor={Brand.muted}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <Pressable
              style={[styles.searchBtn, searching && styles.btnDisabled]}
              onPress={handleSearch}
              disabled={searching}
            >
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Search</Text>}
            </Pressable>
          </View>

          <FlatList
            data={candidates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.candidateRow} onPress={() => selectCandidate(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.candidateName}>{item.firstName} {item.lastName}</Text>
                  <Text style={styles.candidatePhone}>{item.phone}</Text>
                </View>
                <Text style={styles.selectText}>Select →</Text>
              </Pressable>
            )}
            ListEmptyComponent={null}
            style={{ marginTop: 8 }}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Form step ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Pressable onPress={() => setStep('search')} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Change buyer</Text>
        </Pressable>

        <View style={styles.selectedCard}>
          <Text style={styles.selectedName}>{selected?.firstName} {selected?.lastName}</Text>
          <Text style={styles.selectedPhone}>{selected?.phone}</Text>
        </View>

        <Text style={styles.label}>Business name *</Text>
        <TextInput
          style={styles.input}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="e.g. Tendai's Fashion House"
          placeholderTextColor={Brand.muted}
        />

        <Text style={styles.label}>Business phone</Text>
        <TextInput
          style={styles.input}
          value={businessPhone}
          onChangeText={setBusinessPhone}
          placeholder={selected?.phone}
          keyboardType="phone-pad"
          placeholderTextColor={Brand.muted}
        />

        <Pressable
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={() => handleSubmit(false)}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit (online)</Text>}
        </Pressable>

        <Pressable
          style={[styles.offlineBtn, submitting && styles.btnDisabled]}
          onPress={() => handleSubmit(true)}
          disabled={submitting}
        >
          <Text style={styles.offlineBtnText}>Save offline (no signal)</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Brand.pageBg },
  content: { flex: 1, padding: 16 },
  intro: { fontSize: 13, color: Brand.muted, marginBottom: 14, lineHeight: 20 },

  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: Brand.text,
    backgroundColor: Brand.card,
  },
  searchBtn: { backgroundColor: Brand.blue, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  candidateRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Brand.card, borderRadius: 12,
    padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: Brand.border,
  },
  candidateName: { fontSize: 14, fontWeight: '800', color: Brand.navy },
  candidatePhone: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  selectText: { fontSize: 13, color: Brand.blue, fontWeight: '700' },

  backLink: { marginBottom: 12 },
  backLinkText: { color: Brand.blue, fontWeight: '700', fontSize: 14 },

  selectedCard: {
    backgroundColor: Brand.navy, borderRadius: 12, padding: 14, marginBottom: 16,
  },
  selectedName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  selectedPhone: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },

  label: { fontSize: 12, fontWeight: '700', color: Brand.muted, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: Brand.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
    color: Brand.text, backgroundColor: Brand.card,
  },

  submitBtn: { backgroundColor: Brand.blue, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  offlineBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10,
    borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.card,
  },
  offlineBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
