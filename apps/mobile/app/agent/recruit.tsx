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
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { api } from '@/lib/api';
import { Brand } from '@/constants/brand';
import { createTask } from '@/lib/agent-api';
import { enqueueTask } from '@/lib/agent-queue';

function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

export default function RecruitScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ name: string; phone: string; tempPassword: string } | null>(null);

  const validate = () => {
    if (!firstName.trim()) { Alert.alert('Required', 'Enter the contact\'s first name.'); return false; }
    if (!lastName.trim()) { Alert.alert('Required', 'Enter the contact\'s last name.'); return false; }
    const digits = phone.trim().replace(/\D/g, '');
    if (digits.length < 9) { Alert.alert('Invalid phone', 'Enter a valid phone number with country code.'); return false; }
    if (!businessName.trim()) { Alert.alert('Required', 'Enter their business or stall name.'); return false; }
    return true;
  };

  const handleOnline = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const tempPassword = generateTempPassword();
    const normalizedPhone = phone.trim().replace(/[\s\-().]/g, '');
    try {
      // Register the new merchant account — we do NOT use AuthContext.register()
      // because that would replace the agent's own session tokens.
      const regRes = await api.post('/api/v1/auth/register', {
        phone: normalizedPhone,
        password: tempPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: 'STALL_OWNER',
      });

      const newUserId: string | undefined =
        regRes.data?.user?.id ?? regRes.data?.id;

      if (!newUserId) throw new Error('Registration did not return a user ID.');

      // Create the onboarding task immediately
      const offlineId = `local-${Date.now()}`;
      await createTask('MERCHANT_ONBOARDING', {
        userId: newUserId,
        businessName: businessName.trim(),
        businessPhone: normalizedPhone,
        recruitedByAgent: true,
      }, offlineId);

      setDone({ name: `${firstName.trim()} ${lastName.trim()}`, phone: normalizedPhone, tempPassword });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Recruitment failed.';
      const tryOffline = await new Promise<boolean>((resolve) => {
        Alert.alert('Online failed', `${msg}\n\nSave offline and try later?`, [
          { text: 'Save offline', onPress: () => resolve(true) },
          { text: 'Cancel', onPress: () => resolve(false) },
        ]);
      });
      if (tryOffline) await handleOffline(tempPassword);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOffline = async (tempPassword?: string) => {
    if (!validate()) return;
    const pw = tempPassword ?? generateTempPassword();
    const normalizedPhone = phone.trim().replace(/[\s\-().]/g, '');
    setSubmitting(true);
    try {
      await enqueueTask('MERCHANT_ONBOARDING', {
        newUserPhone: normalizedPhone,
        newUserFirstName: firstName.trim(),
        newUserLastName: lastName.trim(),
        newUserTempPassword: pw,
        businessName: businessName.trim(),
        businessPhone: normalizedPhone,
        recruitedByAgent: true,
        requiresRegistration: true,
      });
      setDone({ name: `${firstName.trim()} ${lastName.trim()}`, phone: normalizedPhone, tempPassword: pw });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.scroll}>
        <View style={styles.successHero}>
          <FontAwesome name="check-circle" size={52} color="#fff" />
          <Text style={styles.successTitle}>Recruited!</Text>
          <Text style={styles.successSub}>{done.name} is set up as a merchant.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Hand these credentials to {done.name.split(' ')[0]}</Text>
          <View style={styles.credRow}>
            <Text style={styles.credLabel}>Phone</Text>
            <Text style={styles.credValue}>{done.phone}</Text>
          </View>
          <View style={styles.credRow}>
            <Text style={styles.credLabel}>Temp password</Text>
            <Text style={styles.credValue}>{done.tempPassword}</Text>
          </View>
          <Text style={styles.hint}>
            Ask them to log in and change their password. Once they set up their stall and subscribe, your commission is credited.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Next steps</Text>
          {[
            'Hand them the phone/password above',
            'Help them upload products with "Capture product"',
            'Encourage them to subscribe for full access — that\'s when you earn',
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => router.push('/agent/capture')}>
          <Text style={styles.primaryBtnText}>Capture their first product</Text>
        </Pressable>
        <Pressable style={styles.outlineBtn} onPress={() => router.back()}>
          <Text style={styles.outlineBtnText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <FontAwesome name="user-plus" size={26} color="#fff" />
          <Text style={styles.heroTitle}>Recruit new merchant</Text>
          <Text style={styles.heroSub}>
            Register a brand-new contact who is not yet on Mall263. Their account is created for them — hand them the temporary password.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Contact details</Text>

          <View style={styles.nameRow}>
            <View style={styles.nameHalf}>
              <Text style={styles.label}>First name *</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName}
                placeholder="Tendai" placeholderTextColor={Brand.muted} autoCapitalize="words" editable={!submitting} />
            </View>
            <View style={styles.nameHalf}>
              <Text style={styles.label}>Last name *</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName}
                placeholder="Moyo" placeholderTextColor={Brand.muted} autoCapitalize="words" editable={!submitting} />
            </View>
          </View>

          <Text style={styles.label}>Phone number *</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+263771234567"
            keyboardType="phone-pad"
            placeholderTextColor={Brand.muted}
            editable={!submitting}
          />
          <Text style={styles.fieldHint}>Include country code e.g. +263</Text>

          <Text style={styles.label}>Business / stall name *</Text>
          <TextInput
            style={styles.input}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. Tendai's Fashion House"
            placeholderTextColor={Brand.muted}
            editable={!submitting}
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, submitting && styles.btnDisabled]}
          onPress={handleOnline}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Register & onboard (online)</Text>}
        </Pressable>

        <Pressable
          style={[styles.outlineBtn, submitting && styles.btnDisabled]}
          onPress={() => handleOffline()}
          disabled={submitting}
        >
          <Text style={styles.outlineBtnText}>Save offline (no signal)</Text>
        </Pressable>

        <View style={styles.noteCard}>
          <FontAwesome name="info-circle" size={13} color={Brand.muted} />
          <Text style={styles.noteText}>
            Already on the platform? Use "Onboard merchant" instead — it finds existing buyers by phone number.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },

  hero: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 19 },

  successHero: {
    backgroundColor: Brand.green,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  successTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  successSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center' },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  nameRow: { flexDirection: 'row', gap: 10 },
  nameHalf: { flex: 1 },

  label: { fontSize: 12, fontWeight: '700', color: Brand.navy, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: Brand.pageBg,
  },
  fieldHint: { fontSize: 11, color: Brand.muted, marginTop: 3 },
  hint: { fontSize: 12, color: Brand.muted, lineHeight: 18, marginTop: 6 },

  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  credLabel: { fontSize: 13, color: Brand.muted, fontWeight: '600' },
  credValue: { fontSize: 15, fontWeight: '900', color: Brand.navy, letterSpacing: 1 },

  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },

  primaryBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  outlineBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  outlineBtnText: { color: Brand.navy, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },

  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  noteText: { flex: 1, fontSize: 12, color: Brand.muted, lineHeight: 18 },
});
