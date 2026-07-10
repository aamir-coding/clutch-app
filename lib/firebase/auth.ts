import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './config';
import { firestoreService } from './firestore';

// ── Google Auth Provider ──────────────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();

// Scopes required for Google Calendar, Gmail, and Tasks APIs
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.compose');
googleProvider.addScope('https://www.googleapis.com/auth/tasks');
googleProvider.addScope('https://www.googleapis.com/auth/tasks.readonly');

// `prompt: 'consent'` forces Google to show the consent screen every time
// so we always receive a refresh token. Without this, repeat sign-ins skip
// the consent screen and return no refresh token.
googleProvider.setCustomParameters({
  access_type: 'offline',
  prompt: 'consent',
});

// ── Public auth functions ─────────────────────────────────────────────────────

/**
 * Opens the Google sign-in popup, creates/updates the Firestore user document,
 * and persists the Google API access token.
 *
 * Note on refresh tokens: Firebase's signInWithPopup does not expose the
 * server-side Google OAuth refresh token — only the short-lived access token.
 * Long-term API access (calendar, gmail) requires a separate server-side
 * OAuth consent flow via /api/auth/callback. The access token stored here
 * allows immediate API calls; the server route handles future renewal.
 */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result    = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const user       = result.user;

  // Upsert the user document — safe to call on every sign-in
  try {
    await firestoreService.createUser(
      user.uid,
      user.email       || '',
      user.displayName || '',
      user.photoURL    || ''
    );
  } catch (err) {
    // Non-fatal — user doc may already exist; Firestore rule allows the merge
    console.warn('createUser upsert warning (non-fatal):', err);
  }

  // Persist the access token so server-side Google API calls work immediately
  if (credential?.accessToken) {
    try {
      await firestoreService.saveTokens(
        user.uid,
        credential.accessToken,
        '', // refresh token not available from popup; set via /api/auth/callback
        Date.now() + 3600 * 1000 // 1 hour
      );
    } catch (err) {
      console.warn('saveTokens warning (non-fatal):', err);
    }
  }

  return user;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

// Re-export auth instance and state listener for AuthProvider
export { auth, firebaseOnAuthStateChanged as onAuthStateChanged };
export type { FirebaseUser };