import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mall263:notif_prefs';

export type NotifPrefs = {
  pushEnabled: boolean;
  inAppEnabled: boolean;
  demandUpdates: boolean;
  walletActivity: boolean;
  chatMessages: boolean;
  deliveryUpdates: boolean;
  promotions: boolean;
};

const DEFAULTS: NotifPrefs = {
  pushEnabled: true,
  inAppEnabled: true,
  demandUpdates: true,
  walletActivity: true,
  chatMessages: true,
  deliveryUpdates: true,
  promotions: false,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}
