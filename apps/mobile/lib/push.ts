import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/lib/api';

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

// How foreground notifications appear while the app is open.
// Chat messages are shown silently — the user is likely already reading the thread.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = String(
      (notification.request.content.data as Record<string, unknown>)?.type ?? '',
    );
    const isChatMessage = type === 'NEW_MESSAGE' || type === 'chat';
    return {
      shouldShowAlert: true,
      shouldPlaySound: !isChatMessage,
      shouldSetBadge: !isChatMessage,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Push tokens only work on physical devices
    if (!Device.isDevice) return null;

    // Remote push is not supported in Expo Go on SDK 53+; skip silently.
    if (isExpoGo) return null;

    // Android needs a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mall263',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B9AE1',
        sound: 'default',
      });
      // Chat messages get their own silent channel so they don't chime
      await Notifications.setNotificationChannelAsync('chat', {
        name: 'Chat messages',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100],
        lightColor: '#3B9AE1',
        sound: null,
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
        ?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData.data;
  } catch {
    return null;
  }
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
