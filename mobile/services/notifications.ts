import { Platform } from 'react-native';

// Push notification service
// In production, use expo-notifications or @react-native-firebase/messaging

let ExpoNotifications: any = null;
try {
  ExpoNotifications = require('expo-notifications');
} catch {}

export async function requestPermissions(): Promise<boolean> {
  if (!ExpoNotifications) {
    console.log('expo-notifications not installed');
    return false;
  }
  try {
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getPushToken(): Promise<string | null> {
  if (!ExpoNotifications) return null;
  try {
    const token = await ExpoNotifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

export async function registerPushToken(apiPost: (path: string, body?: any) => Promise<any>) {
  const token = await getPushToken();
  if (!token) return;
  try {
    await apiPost('/api/mobile/push/register', { token, platform: Platform.OS });
  } catch {}
}

export function configureNotifications(apiPost: (path: string, body?: any) => Promise<any>) {
  if (!ExpoNotifications) return;

  ExpoNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Handle notification taps
  ExpoNotifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data;
    // Navigate based on notification data
    if (data?.type === 'payment') {
      // Navigate to subscription
    } else if (data?.type === 'techcard') {
      // Navigate to specific tech card
    }
  });
}

export async function scheduleLocalNotification(title: string, body: string, data?: any) {
  if (!ExpoNotifications) return;
  try {
    await ExpoNotifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null, // immediate
    });
  } catch {}
}
