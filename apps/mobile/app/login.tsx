import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/config';
import { Brand } from '@/constants/brand';
import { getStaffHomePath, isStaffAdminRole } from '@mall263/shared';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!phone.trim() || !password) {
      Alert.alert('Missing fields', 'Enter your phone number and password.');
      return;
    }
    setSubmitting(true);
    try {
      const me = await login(phone, password);
      const next = isStaffAdminRole(me.role)
        ? (getStaffHomePath(me.role) ?? '/admin')
        : '/(tabs)/shop';
      router.replace(next as never);
    } catch (err: unknown) {
      let msg: string | undefined;
      if (axios.isAxiosError(err)) {
        msg = err.response?.data?.message;
        if (!msg && !err.response) {
          msg = `Cannot reach server at ${getApiBaseUrl()} — check Wi‑Fi/data, stop/restart Expo (clear cache: npx expo start -c), and confirm the API is up.`;
        }
      } else if (err && typeof err === 'object' && 'response' in err) {
        msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      }
      Alert.alert('Sign in failed', typeof msg === 'string' ? msg : 'Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Mall263</Text>
        <Text style={styles.subtitle}>Sign in with your phone</Text>

        <Text style={styles.label}>Phone</Text>
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
        <Text style={styles.hint}>Include country code (10–15 digits after +).</Text>

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Your password"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
        />
        <Text style={styles.hint}>Same password you use on the web app.</Text>

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>New to Mall263?</Text>
          <Link href="/register" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.registerLink}>Create account</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.pageBg,
  },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Brand.navy,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Brand.muted,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.navy,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Brand.text,
    marginBottom: 4,
    backgroundColor: Brand.pageBg,
  },
  hint: {
    fontSize: 12,
    color: Brand.muted,
    marginBottom: 16,
  },
  button: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Brand.border,
    marginVertical: 18,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  registerPrompt: {
    fontSize: 13,
    color: Brand.muted,
  },
  registerLink: {
    fontSize: 13,
    color: Brand.blue,
    fontWeight: '800',
  },
});
