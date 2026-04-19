import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Brand } from '@/constants/brand';
import { openDispute } from '@/lib/delivery-api';
import { getApiErrorMessage } from '@/lib/api-errors';

export default function DisputeScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const [reason, setReason] = useState('');

  if (!jobId || typeof jobId !== 'string') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={[styles.heroBand, { backgroundColor: Brand.muted }]}>
          <Text style={styles.heroTitle}>Invalid Link</Text>
          <Text style={styles.heroSub}>No job ID was provided.</Text>
        </View>
      </ScrollView>
    );
  }

  const mutation = useMutation({
    mutationFn: () => openDispute(jobId, { reason: reason.trim() }),
    onSuccess: () => {
      Alert.alert('Dispute Opened', 'Our team will review and respond within 24 hours.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: unknown) =>
      Alert.alert('Could not open dispute', getApiErrorMessage(err, 'Failed to open dispute.')),
  });

  const canSubmit = reason.trim().length >= 10 && !mutation.isPending;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heroBand}>
        <Text style={styles.heroTitle}>Open a Dispute</Text>
        <Text style={styles.heroSub}>
          Use this only if your delivery had a genuine issue. Frivolous disputes affect your trust score.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Reason *</Text>
        <TextInput
          style={styles.input}
          placeholder="Describe what went wrong (min 10 characters)"
          placeholderTextColor={Brand.muted}
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <Text style={styles.hint}>{reason.trim().length} / 10 characters minimum</Text>
      </View>

      <Pressable
        style={[styles.submitBtn, !canSubmit && styles.disabled]}
        onPress={() => {
          if (!canSubmit) return;
          Alert.alert(
            'Confirm Dispute',
            'Are you sure you want to open a dispute? This will pause any escrow release.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Dispute', style: 'destructive', onPress: () => mutation.mutate() },
            ],
          );
        }}
        disabled={!canSubmit}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit Dispute</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.pageBg },
  content: { padding: 20 },
  heroBand: {
    backgroundColor: Brand.red,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6 },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: 16,
  },
  label: { fontSize: 13, fontWeight: '800', color: Brand.muted, textTransform: 'uppercase', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Brand.text,
    minHeight: 120,
  },
  hint: { fontSize: 12, color: Brand.muted, marginTop: 6, textAlign: 'right' },
  submitBtn: {
    backgroundColor: Brand.red,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
