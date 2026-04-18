import { useCallback, useState } from 'react';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Brand } from '@/constants/brand';
import { createDemand } from '@/lib/demands-api';
import { getApiErrorMessage } from '@/lib/api-errors';

const URGENCIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export default function NewDemandScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    title?: string;
    description?: string;
    maxBudget?: string;
    minBudget?: string;
  }>();
  const [title, setTitle] = useState(params.title ?? '');
  const [description, setDescription] = useState(params.description ?? '');
  const [maxBudget, setMaxBudget] = useState(params.maxBudget ?? '');
  const [minBudget, setMinBudget] = useState(params.minBudget ?? '');
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number]>('MEDIUM');

  const mutation = useMutation({
    mutationFn: () => {
      const max = parseFloat(maxBudget.replace(/,/g, ''));
      if (!Number.isFinite(max) || max < 0.01) {
        return Promise.reject(new Error('Enter a valid max budget (at least 0.01).'));
      }
      const minRaw = minBudget.trim() ? parseFloat(minBudget.replace(/,/g, '')) : undefined;
      if (minRaw !== undefined && (!Number.isFinite(minRaw) || minRaw < 0)) {
        return Promise.reject(new Error('Min budget must be a valid number.'));
      }
      return createDemand({
        title: title.trim(),
        description: description.trim() || undefined,
        maxBudget: max,
        minBudget: minRaw,
        urgency,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['my-demands'] });
      Alert.alert('Posted', 'Your demand is live. Sellers can send offers.', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/demand/[id]', params: { id: created.id } }) },
      ]);
    },
    onError: (err: unknown) => {
      Alert.alert('Could not post', getApiErrorMessage(err, 'Could not post demand.'));
    },
  });

  const onSubmit = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Describe what you are looking for.');
      return;
    }
    mutation.mutate();
  }, [title, mutation]);

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>
          New accounts: no wallet lock for your first week. After that, posting locks 10% of your max budget until the
          demand closes — fund your wallet first.
        </Text>

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Red running shoes, size 9"
          placeholderTextColor={Brand.muted}
          maxLength={500}
        />

        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Brand, condition, deadline…"
          placeholderTextColor={Brand.muted}
          multiline
          maxLength={5000}
        />

        <Text style={styles.label}>Max budget (USD) *</Text>
        <TextInput
          style={styles.input}
          value={maxBudget}
          onChangeText={setMaxBudget}
          placeholder="0.00"
          placeholderTextColor={Brand.muted}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Min budget (optional)</Text>
        <TextInput
          style={styles.input}
          value={minBudget}
          onChangeText={setMinBudget}
          placeholder="0.00"
          placeholderTextColor={Brand.muted}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Urgency</Text>
        <View style={styles.urgencyRow}>
          {URGENCIES.map((u) => (
            <Pressable
              key={u}
              style={[styles.urgencyChip, urgency === u && styles.urgencyChipOn]}
              onPress={() => setUrgency(u)}
            >
              <Text style={[styles.urgencyChipText, urgency === u && styles.urgencyChipTextOn]}>{u}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.submit, mutation.isPending && styles.submitDisabled]}
          onPress={onSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Post demand</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 40 },
  note: {
    fontSize: 13,
    color: Brand.muted,
    lineHeight: 19,
    marginBottom: 18,
    backgroundColor: Brand.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  label: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: Brand.text,
    marginBottom: 14,
    backgroundColor: Brand.card,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  urgencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  urgencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  urgencyChipOn: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  urgencyChipText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
  urgencyChipTextOn: { color: '#fff' },
  submit: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
