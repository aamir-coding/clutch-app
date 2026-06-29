import { apps, initializeApp, credential, ServiceAccount } from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (serviceAccountKey) {
  try {
    if (apps.length === 0) {
      const serviceAccount: ServiceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: credential.cert(serviceAccount),
      });
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
} else {
  console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not defined.');
}

export const adminDb = apps.length > 0 ? getFirestore() : null as any;
export const adminAuth = apps.length > 0 ? getAuth() : null as any;
export const adminMessaging = apps.length > 0 ? getMessaging() : null as any;
