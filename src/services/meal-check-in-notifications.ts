import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsPackage = typeof import('expo-notifications');

export type MealCheckInNotificationResult =
  | { identifier: string; status: 'scheduled' }
  | { status: 'permission-denied' | 'unavailable' };

let notificationsPackage: NotificationsPackage | null | undefined;

export function configureMealCheckInNotifications(): void {
  const notifications = loadNotifications();
  notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function scheduleMealCheckInNotification(input: {
  delayMinutes: number;
  mealId: number;
  mealName: string;
}): Promise<MealCheckInNotificationResult> {
  const notifications = loadNotifications();
  if (!notifications) {
    return { status: 'unavailable' };
  }

  const existingPermission = await notifications.getPermissionsAsync();
  const permission = existingPermission.granted
    ? existingPermission
    : await notifications.requestPermissionsAsync();

  if (!permission.granted) {
    return { status: 'permission-denied' };
  }

  const seconds = Math.max(1, Math.round(input.delayMinutes * 60));
  const identifier = await notifications.scheduleNotificationAsync({
    content: {
      body: `How did you feel after ${input.mealName}? A quick check-in helps build your personal baseline.`,
      data: { url: `/check-in/${input.mealId}` },
      title: 'Time for a quick check-in',
    },
    trigger: {
      repeats: false,
      seconds,
      type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    },
  });

  return { identifier, status: 'scheduled' };
}

export async function cancelMealCheckInNotification(identifier: string | null): Promise<void> {
  const notifications = loadNotifications();
  if (!notifications || !identifier) {
    return;
  }

  await notifications.cancelScheduledNotificationAsync(identifier);
}

function loadNotifications(): NotificationsPackage | null {
  if (
    Platform.OS === 'web' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return null;
  }

  if (notificationsPackage === undefined) {
    // Expo Go intentionally lacks the complete Android notifications native surface.
    // Load only after the execution-environment guard so its manual fallback remains usable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsPackage = require('expo-notifications');
  }

  return notificationsPackage ?? null;
}
