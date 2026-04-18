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
import { Link, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/config';
import { Brand } from '@/constants/brand';
import { Logo } from '@/components/Logo';

type RoleChoice = 'BUYER' | 'STALL_OWNER' | 'DELIVERY_DRIVER';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RoleChoice>('BUYER');
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const onSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing name', 'Enter your first and last name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Missing phone', 'Enter your phone number with country code.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Make sure both password fields are identical.');
      return;
    }
    if (!acceptedTerms) {
      Alert.alert('Accept terms', 'Please accept the terms of service to continue.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        firstName,
        lastName,
        phone,
        password,
        role,
      });
      if (role === 'STALL_OWNER') {
        router.replace('/seller/setup');
      } else if (role === 'DELIVERY_DRIVER') {
        router.replace('/driver/register');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      let msg: string | undefined;
      if (axios.isAxiosError(err)) {
        const body = err.response?.data as { message?: string | string[] } | undefined;
        msg = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message;
        if (!msg && !err.response) {
          msg = `Cannot reach server at ${getApiBaseUrl()} — check your connection and try again.`;
        }
      }
      Alert.alert('Sign up failed', typeof msg === 'string' ? msg : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Logo size={52} />
          <Text style={styles.brandName}>Mall263</Text>
          <Text style={styles.subtitle}>Create your account in seconds</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>I am joining as</Text>
          <View style={styles.roleRow}>
            <RoleOption
              active={role === 'BUYER'}
              onPress={() => setRole('BUYER')}
              icon="shopping-bag"
              label="Buyer"
              desc="Shop and post demands"
            />
            <RoleOption
              active={role === 'STALL_OWNER'}
              onPress={() => setRole('STALL_OWNER')}
              icon="briefcase"
              label="Seller"
              desc="List products & sell"
            />
            <RoleOption
              active={role === 'DELIVERY_DRIVER'}
              onPress={() => setRole('DELIVERY_DRIVER')}
              icon="truck"
              label="Driver"
              desc="Deliver & earn"
            />
          </View>
          {role === 'DELIVERY_DRIVER' && (
            <View style={styles.roleNote}>
              <FontAwesome name="info-circle" size={13} color={Brand.blue} />
              <Text style={styles.roleNoteText}>
                After creating your account you'll complete your vehicle & KYC details. Buyers and sellers can also become drivers later from their profile.
              </Text>
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                placeholder="Tendai"
                placeholderTextColor="#9ca3af"
                value={firstName}
                onChangeText={setFirstName}
                editable={!submitting}
                autoComplete="given-name"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Last name</Text>
              <TextInput
                style={styles.input}
                placeholder="Moyo"
                placeholderTextColor="#9ca3af"
                value={lastName}
                onChangeText={setLastName}
                editable={!submitting}
                autoComplete="family-name"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="+263771234567"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={phone}
            onChangeText={setPhone}
            editable={!submitting}
          />
          <Text style={styles.hint}>Include country code. 10–15 digits after the +.</Text>

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
            editable={!submitting}
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            autoComplete="password-new"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!submitting}
          />

          <Pressable
            onPress={() => setAcceptedTerms((v) => !v)}
            style={styles.termsRow}
            disabled={submitting}
            hitSlop={6}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}>
              {acceptedTerms ? <FontAwesome name="check" size={12} color="#fff" /> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the Mall263 terms of service and privacy policy.
            </Text>
          </Pressable>

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account?</Text>
            <Link href="/login" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.loginLink}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleOption({
  active,
  onPress,
  icon,
  label,
  desc,
}: {
  active: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  desc: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.roleCard,
        active && styles.roleCardActive,
        pressed && styles.roleCardPressed,
      ]}
    >
      <View style={[styles.roleIconWrap, active && styles.roleIconWrapActive]}>
        <FontAwesome name={icon} size={20} color={active ? '#fff' : Brand.blue} />
      </View>
      <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{label}</Text>
      <Text style={styles.roleDesc}>{desc}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.pageBg },
  scrollContent: { padding: 20, paddingTop: 40, paddingBottom: 48 },

  logoWrap: { alignItems: 'center', marginBottom: 20 },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: Brand.navy,
    letterSpacing: -0.4,
    marginTop: 12,
  },
  subtitle: { fontSize: 14, color: Brand.muted, marginTop: 4 },

  card: {
    backgroundColor: Brand.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  roleNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eff6fc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  roleNoteText: { flex: 1, fontSize: 12, color: Brand.blue, lineHeight: 18 },
  roleCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: '#fafbfd',
    gap: 4,
  },
  roleCardActive: { borderColor: Brand.blue, backgroundColor: '#eff6fc' },
  roleCardPressed: { opacity: 0.85 },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e6f1fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  roleIconWrapActive: { backgroundColor: Brand.blue },
  roleLabel: { fontSize: 15, fontWeight: '800', color: Brand.navy },
  roleLabelActive: { color: Brand.blue },
  roleDesc: { fontSize: 11, color: Brand.muted },

  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.navy,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 11,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: '#fafbfd',
  },
  hint: { fontSize: 11, color: Brand.muted, marginTop: 5 },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: Brand.blue, borderColor: Brand.blue },
  termsText: { flex: 1, fontSize: 12, color: Brand.muted, lineHeight: 17 },

  button: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  divider: { height: 1, backgroundColor: Brand.border, marginVertical: 18 },

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loginPrompt: { fontSize: 13, color: Brand.muted },
  loginLink: { fontSize: 13, color: Brand.blue, fontWeight: '800' },
});
