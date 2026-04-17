import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/lib/api';

// How foreground notifications appear while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  // Push tokens only work on physical devices
  if (!Device.isDevice) return null;

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Mall263',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B9AE1',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export async function savePushTokenToBackend(token: string) {
  try {
    await api.post('/api/v1/notifications/push-token', { token });
  } catch {
    // Non-critical — swallow silently
  }
}

/** Route a notification tap to the correct screen. */
export function resolveNotificationRoute(
  data: Record<string, string> | undefined,
  type: string,
): string | null {
  if (!data) return null;

  if (type.startsWith('DELIVERY_') || type === 'DISPUTE_OPENED' || type === 'DISPUTE_RESOLVED') {
    if (data.jobId) return `/delivery/track/${data.jobId}`;
  }
  if (type === 'OFFER_RECEIVED' || type === 'OFFER_ACCEPTED' || type === 'OFFER_REJECTED') {
    if (data.demandId) return `/demand/${data.demandId}`;
  }
  if (type === 'NEW_MESSAGE') {
    if (data.roomId) return `/chat/${data.roomId}`;
  }

  return null;
}
