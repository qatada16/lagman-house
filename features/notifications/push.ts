import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { savePushToken } from '@/features/auth/authApi';
import { updateOwnProfileLocal } from '@/features/auth/profileRepo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPush(userId: string, currentToken: string | null): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Orders and requests',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const perms = await Notifications.getPermissionsAsync();
  let status = perms.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  try {
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    if (token && token !== currentToken) {
      try {
        await savePushToken(userId, token);
      } catch {
        updateOwnProfileLocal(userId, { push_token: token });
      }
    }
    return token;
  } catch (e) {
    console.warn('[push] token failed', (e as Error).message);
    return null;
  }
}

export type PushData = { type?: 'cashier_request' | 'status_change' | 'customer_order'; id?: string; user_id?: string; status?: string };

export function addNotificationListeners(handlers: {
  onReceived?: (data: PushData, title: string | null, body: string | null) => void;
  onResponse?: (data: PushData) => void;
}) {
  const a = Notifications.addNotificationReceivedListener((n) => {
    handlers.onReceived?.((n.request.content.data ?? {}) as PushData, n.request.content.title, n.request.content.body);
  });
  const b = Notifications.addNotificationResponseReceivedListener((r) => {
    handlers.onResponse?.((r.notification.request.content.data ?? {}) as PushData);
  });
  return () => {
    a.remove();
    b.remove();
  };
}
