import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Show notifications while the app is open too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/**
 * Ask for permission and register this phone's Expo push token with the API.
 * Needs a physical device and an EAS project ID (set by `eas init`); silently skips otherwise.
 */
export async function registerForPush(api, app) {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Consultations & bookings', importance: Notifications.AndroidImportance.HIGH });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post('/devices', { token, platform: Platform.OS, app });
  return token;
}

/** Call from the root layout: opens the right screen when a notification is tapped. */
export function onNotificationTap(handler) {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((r) => handler(r.notification.request.content.data || {}));
  return () => sub.remove();
}
