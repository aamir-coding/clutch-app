import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getMessaging as getFirebaseMessaging, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

let messagingInstance: Messaging | null = null;
let messagingChecked = false;

/**
 * Lazily initializes Firebase Cloud Messaging.
 * Returns null on the server, in unsupported browsers, or if initialization fails.
 * Safe to call multiple times — the result is cached after the first call.
 */
export function getMessaging(): Messaging | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (messagingChecked) {
    return messagingInstance;
  }

  messagingChecked = true;
  try {
    messagingInstance = getFirebaseMessaging(app);
  } catch (err) {
    console.warn('Firebase Messaging is not supported in this environment:', err);
    messagingInstance = null;
  }

  return messagingInstance;
}

export default app;