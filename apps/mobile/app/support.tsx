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
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Brand } from '@/constants/brand';

const TOPICS = [
  'Account issue',
  'Payment / wallet',
  'Delivery problem',
  'Product / listing',
  'Dispute help',
  'Feature request',
  'Other',
];

export default function SupportScreen() {
  const { isAuthenticated } = useAuth();
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!topic) {
      Alert.alert('Pick a topic', 'Let us know what your question is about.');
      return;
    }
    if (message.trim().length < 10) {
      Alert.alert('Add more detail', 'Please describe your issue in at least 10 characters.');
      return;
    }
    if (!isAuthenticated) {
      if (!contactName.trim() || !contactPhone.trim()) {
        Alert.alert(
          'Contact details required',
          'When signed out you must provide your name and phone number.',
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        topic: topic.trim(),
        message: message.trim(),
      };
      if (contactName.trim()) body.contactName = contactName.trim();
      if (contactPhone.trim()) body.contactPhone = contactPhone.trim();
      if (contactEmail.trim()) body.contactEmail = contactEmail.trim();
      await api.post('/api/v1/support-requests', body);
      Alert.alert(
        'Request sent',
        'Our team will get back to you shortly. You can continue using the app in the meantime.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      let msg = 'Could not send your request. Please try again.';
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string | string[] } | undefined;
        const m = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        if (m) msg = m;
      }
      Alert.alert('Error', msg);
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
          <FontAwesome name="life-ring" size={22} color="#fff" style={{ marginBottom: 8 }} />
          <Text style={styles.heroTitle}>We&apos;re here to help</Text>
          <Text style={styles.heroSub}>
            Tell us what&apos;s going on and our team will follow up by phone or the app.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Topic</Text>
          <View style={styles.chipsRow}>
            {TOPICS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTopic(t)}
                style={[styles.chip, topic === t && styles.chipActive]}
                disabled={submitting}
              >
                <Text style={[styles.chipText, topic === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue, include order ID or relevant details if any"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={6}
            editable={!submitting}
          />

          <View style={styles.hr} />
          <Text style={styles.sectionLabel}>Contact</Text>
          <Text style={styles.hint}>
            {isAuthenticated
              ? 'We already have your account phone. Override only if needed.'
              : 'Please give us your details so we can reply.'}
          </Text>

          <Text style={styles.label}>Name{!isAuthenticated ? ' *' : ''}</Text>
          <TextInput
            style={styles.input}
            value={contactName}
            onChangeText={setContactName}
            placeholder="Your full name"
            placeholderTextColor="#9ca3af"
            editable={!submitting}
          />

          <Text style={styles.label}>Phone{!isAuthenticated ? ' *' : ''}</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+263771234567"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            editable={!submitting}
          />

          <Text style={styles.label}>Email (optional)</Text>
          <TextInput
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
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
  scroll: { padding: 14, gap: 12, paddingBottom: 40 },

  hero: {
    backgroundColor: Brand.blue,
    padding: 20,
    borderRadius: 18,
    alignItems: 'flex-start',
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  heroSub: { color: '#ffffffcc', fontSize: 13, marginTop: 4, lineHeight: 18 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
  },

  label: { fontSize: 12, fontWeight: '800', color: Brand.navy, marginBottom: 6, marginTop: 8 },
  hint: { fontSize: 12, color: Brand.muted, marginBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  chipText: { fontSize: 12, fontWeight: '700', color: Brand.navy },
  chipTextActive: { color: '#fff' },

  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: '#fafbfd',
    marginBottom: 4,
  },
  textarea: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },

  hr: { height: 1, backgroundColor: Brand.border, marginVertical: 16 },

  submitBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
