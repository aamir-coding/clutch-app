import { getToken, onMessage, Messaging } from 'firebase/messaging';
import { getMessaging } from './config';
import { firestoreService } from './firestore';
import { arrayUnion } from 'firebase/firestore';

export async function requestAndSaveToken(userId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    const messaging = getMessaging();
    if (!messaging) {
      console.error('Firebase Messaging is not supported or initialized');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    });

    if (token) {
      await firestoreService.updateUser(userId, {
        fcmTokens: arrayUnion(token) as any
      });
      return token;
    }
    return null;
  } catch (err) {
    console.error('Error requesting or saving FCM token:', err);
    return null;
  }
}

export function onForegroundMessage(
  handler: (payload: { notification: { title: string; body: string }; data: { taskId?: string } }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const messaging = getMessaging();
  if (!messaging) return () => {};

  try {
    return onMessage(messaging, (payload: any) => {
      handler({
        notification: {
          title: payload.notification?.title || '',
          body: payload.notification?.body || '',
        },
        data: {
          taskId: payload.data?.taskId,
        },
      });
    });
  } catch (err) {
    console.error('Error registering onForegroundMessage handler:', err);
    return () => {};
  }
}

export function showBrowserNotification(title: string, body: string, taskId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon.png',
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = `/crisis/${taskId}`;
    };
  } catch (err) {
    console.error('Error showing browser notification:', err);
  }
}
