import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Brand } from '@/constants/brand';
import { getNotifPrefs, saveNotifPrefs, type NotifPrefs } from '@/lib/notification-prefs';

type PrefRow = {
  key: keyof NotifPrefs;
  label: string;
  description: string;
  icon: string;
};

const ROWS: PrefRow[] = [
  { key: 'pushEnabled', label: 'Push notifications', description: 'Receive alerts on your device even when the app is closed.', icon: 'bell' },
  { key: 'inAppEnabled', label: 'In-app alerts', description: 'Show notification badges and in-app banners while using the app.', icon: 'commenting' },
  { key: 'demandUpdates', label: 'Demand & offer updates', description: 'Notify you when a seller responds to your demand or an offer is accepted.', icon: 'list' },
  { key: 'walletActivity', label: 'Wallet activity', description: 'Alerts for deposits, withdrawals, and wallet transactions.', icon: 'money' },
  { key: 'chatMessages', label: 'Chat messages', description: 'Notify you when you receive a new chat message.', icon: 'comments' },
  { key: 'deliveryUpdates', label: 'Delivery updates', description: 'Track your delivery job status from pickup to drop-off.', icon: 'truck' },
  { key: 'promotions', label: 'Promotions & offers', description: 'Occasional promos, new seller announcements, and platform news.', icon: 'tag' },
];

export default function NotificationSettingsScreen() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getNotifPrefs().then(setPrefs);
  }, []);

  const toggle = useCallback((key: keyof NotifPrefs) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: !prev[key] };
    });
    setDirty(true);
  }, []);

  const onSave = useCallback(async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      await saveNotifPrefs(prefs);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  if (!prefs) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Brand.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <FontAwesome name="bell" size={28} color="#fff" />
        <Text style={styles.heroTitle}>Notification preferences</Text>
        <Text style={styles.heroSub}>
          These preferences are stored on this device. Push alerts also depend on your phone's system settings.
        </Text>
      </View>

      <View style={styles.card}>
        {ROWS.map((row, i) => (
          <View key={row.key} style={[styles.row, i < ROWS.length - 1 && styles.rowBorder]}>
            <View style={styles.iconBox}>
              <FontAwesome name={row.icon as any} size={16} color={Brand.blue} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowDesc}>{row.description}</Text>
            </View>
            <Switch
              value={prefs[row.key]}
              onValueChange={() => toggle(row.key)}
              trackColor={{ false: Brand.border, true: Brand.blue }}
              thumbColor={Platform.OS === 'ios' ? '#fff' : prefs[row.key] ? '#fff' : '#f4f3f4'}
              ios_backgroundColor={Brand.border}
            />
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.saveBtn, (!dirty || saving) && styles.btnDisabled]}
        onPress={onSave}
        disabled={!dirty || saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>{dirty ? 'Save preferences' : 'Saved'}</Text>
        )}
      </Pressable>

      <View style={styles.noteCard}>
        <FontAwesome name="info-circle" size={14} color={Brand.muted} />
        <Text style={styles.noteText}>
          To fully disable push notifications, also go to your phone's System Settings → Notifications → Mall263.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Brand.pageBg },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.pageBg },
  hero: {
    backgroundColor: Brand.navy,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', fontWeight: '500', lineHeight: 19 },
  card: {
    backgroundColor: Brand.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.border,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Brand.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    flexShrink: 0,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '700', color: Brand.navy },
  rowDesc: { fontSize: 12, color: Brand.muted, marginTop: 2, lineHeight: 17 },
  saveBtn: {
    backgroundColor: Brand.blue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  btnDisabled: { opacity: 0.55 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  noteText: { flex: 1, fontSize: 13, color: Brand.muted, lineHeight: 19 },
});
