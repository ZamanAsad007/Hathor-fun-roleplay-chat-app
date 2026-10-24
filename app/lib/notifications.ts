import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const IDLE_NOTIFICATION_IDENTIFIER = 'hathor-idle-impatience';

// Configure notification presentation when app is foregrounded
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
} catch {
  // Gracefully ignore handler errors on unsupported platforms
}

/**
 * Requests notification permissions if not already granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('hathor-idle', {
        name: 'Hathor Idle Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
      });
    }

    return true;
  } catch (err) {
    console.warn('Could not request notification permissions:', err);
    return false;
  }
}

/**
 * Resets the 24-hour idle reminder timer.
 * Schedules: "Hathor is growing impatient…" after 24h.
 */
export async function scheduleIdleNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    // Cancel existing scheduled idle notifications first
    await cancelIdleNotification();

    // 24 hours in seconds = 86400
    const triggerSeconds = 24 * 60 * 60;

    await Notifications.scheduleNotificationAsync({
      identifier: IDLE_NOTIFICATION_IDENTIFIER,
      content: {
        title: 'Hathor is growing impatient…',
        body: 'The incense burns low in the sacred court. Return to me before the sands grow cold.',
        sound: true,
        data: { type: 'idle_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerSeconds,
        repeats: false,
      },
    });
  } catch (err) {
    console.warn('Could not schedule idle notification:', err);
  }
}

/**
 * Cancels any pending idle reminder notifications.
 */
export async function cancelIdleNotification(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(IDLE_NOTIFICATION_IDENTIFIER);
  } catch {
    // Gracefully ignore
  }
}
