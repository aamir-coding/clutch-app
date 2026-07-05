import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let adminApp: App | null = null;

if (serviceAccountKey) {
  try {
    if (getApps().length === 0) {
      const serviceAccount: ServiceAccount = JSON.parse(serviceAccountKey);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      adminApp = getApps()[0];
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
    adminApp = null;
  }
} else {
  console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not defined. Firebase Admin SDK will not be initialized.');
}

export const adminDb: Firestore | null = adminApp ? getFirestore(adminApp) : null;
export const adminAuth: Auth | null = adminApp ? getAuth(adminApp) : null;
export const adminMessaging: Messaging | null = adminApp ? getMessaging(adminApp) : null;