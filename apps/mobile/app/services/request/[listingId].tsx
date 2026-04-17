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
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { createServiceRequest, fetchServiceListing } from '@/lib/services-api';
import { Brand } from '@/constants/brand';

export default function ServiceRequestScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const [notes, setNotes] = useState('');
  const [budget, setBudget] = useState('');

  const listingQ = useQuery({
    queryKey: ['service-listing', listingId],
    queryFn: () => fetchServiceListing(listingId!),
    enabled: !!listingId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!listingId) throw new Error('Missing listing id');
      const body: { notes?: string; budgetHint?: number } = {};
      if (notes.trim()) body.notes = notes.trim();
      if (budget.trim()) {
        const n = parseFloat(budget);
        if (Number.isFinite(n) && n > 0) body.budgetHint = n;
      }
      return createServiceRequest(listingId, body);
    },
    onSuccess: (req) => {
      Alert.alert('Request sent', 'The provider will review and send you a quote.', [
        {
          text: 'View request',
          onPress: () =>
            router.replace({ pathname: '/services/requests/[requestId]', params: { requestId: req.id } }),
        },
        { text: 'Back to services', onPress: () => router.replace('/services') },
      ]);
    },
    onError: (err) => {
      let msg = 'Failed to send request.';
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string | string[] } | undefined;
        const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        if (m) msg = m;
      }
      Alert.alert('Error', msg);
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {listingQ.isPending ? (
            <ActivityIndicator color={Brand.blue} />
          ) : listingQ.data ? (
            <>
              <Text style={styles.sectionLabel}>You&apos;re requesting</Text>
              <Text style={styles.serviceTitle}>{listingQ.data.title}</Text>
              {listingQ.data.provider ? (
                <Text style={styles.provider}>
                  by {`${listingQ.data.provider.firstName ?? ''} ${listingQ.data.provider.lastName ?? ''}`.trim()}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.serviceTitle}>Service request</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>What do you need?</Text>
          <Text style={styles.hint}>Give the provider context so they can quote accurately.</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe the job, timing, location, any materials needed..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={6}
            editable={!mutation.isPending}
          />

          <Text style={styles.label}>Budget hint (optional)</Text>
          <Text style={styles.hint}>Helps the provider tailor the quote.</Text>
          <View style={styles.currencyRow}>
            <View style={styles.currencyPrefix}>
              <Text style={styles.currencyPrefixText}>USD</Text>
            </View>
            <TextInput
              style={[styles.input, styles.currencyInput]}
              value={budget}
              onChangeText={setBudget}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              editable={!mutation.isPending}
            />
          </View>

          <Pressable
            style={[styles.submitBtn, mutation.isPending && styles.submitBtnDisabled]}
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <FontAwesome name="paper-plane" size={14} color="#fff" />
                <Text style={styles.submitBtnText}>Send request</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 14, paddingBottom: 40, gap: 12 },

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
    marginBottom: 6,
  },
  serviceTitle: { fontSize: 18, fontWeight: '900', color: Brand.navy, letterSpacing: -0.3 },
  provider: { fontSize: 12, color: Brand.muted, marginTop: 4 },

  label: { fontSize: 13, fontWeight: '800', color: Brand.navy, marginBottom: 4, marginTop: 4 },
  hint: { fontSize: 12, color: Brand.muted, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: '#fafbfd',
    marginBottom: 14,
  },
  textarea: { minHeight: 130, textAlignVertical: 'top', paddingTop: 12 },

  currencyRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 14 },
  currencyPrefix: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#eff6fc',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: Brand.border,
  },
  currencyPrefixText: { color: Brand.blue, fontWeight: '900', fontSize: 12 },
  currencyInput: {
    flex: 1,
    marginBottom: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },

  submitBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
