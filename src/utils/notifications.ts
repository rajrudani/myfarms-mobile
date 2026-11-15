import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import apiClient from '../api/client';
import { storage } from './storage';

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Configure Android notification channels.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('farm-reminders', {
      name: 'Farm Reminders & Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#166534',
    });
  }
}

/**
 * Request notification permissions and register push token with backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    await setupNotificationChannels();

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    let token = '';
    try {
      const pushTokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = pushTokenData.data;
    } catch {
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        token = deviceToken.data;
      } catch {
        return null;
      }
    }

    if (token) {
      await storage.setPushToken(token);

      const authToken = await storage.getToken();
      if (authToken) {
        await apiClient.post('/profile/push-token', { push_token: token }).catch(() => {});
      }
    }

    return token;
  } catch (error) {
    console.warn('Failed to register for push notifications:', error);
    return null;
  }
}

/**
 * Schedule a local device reminder (e.g., Note Reminder, Spraying date, Harvest date).
 */
export async function scheduleLocalReminder(options: {
  title: string;
  body: string;
  triggerDate: Date;
  data?: Record<string, any>;
}): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        data: options.data,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: options.triggerDate,
        channelId: Platform.OS === 'android' ? 'farm-reminders' : undefined,
      },
    });
    return id;
  } catch (error) {
    console.warn('Failed to schedule local notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled reminder.
 */
export async function cancelReminder(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Failed to cancel notification:', error);
  }
}
