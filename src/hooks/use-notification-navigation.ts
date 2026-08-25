import type { Notification } from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

function navigateFromNotification(notification: Notification): void {
  const url = notification.request.content.data?.url;
  if (typeof url !== 'string') {
    return;
  }

  const match = /^\/check-in\/([^/?#]+)$/.exec(url);
  const mealId = match?.[1];
  if (!mealId) {
    return;
  }

  router.push({ pathname: '/check-in/[mealId]', params: { mealId: decodeURIComponent(mealId) } });
}

export function useNotificationNavigation(): void {
  useEffect(() => {
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) {
      navigateFromNotification(lastResponse.notification);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotification(response.notification);
    });

    return () => subscription.remove();
  }, []);
}
