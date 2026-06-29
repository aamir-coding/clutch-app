import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './config';
import { firestoreService } from './firestore';

export class AuthService {
  async signInWithGoogle(): Promise<{ user: FirebaseUser; accessToken: string }> {
    const provider = new GoogleAuthProvider();
    
    // Add mandatory scopes
    provider.addScope('https://www.googleapis.com/auth/calendar');
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    provider.addScope('https://www.googleapis.com/auth/gmail.compose');
    provider.addScope('https://www.googleapis.com/auth/tasks');

    // Request offline access and consent to guarantee refresh token on first sign in
    provider.setCustomParameters({
      access_type: 'offline',
      prompt: 'consent'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential) {
        throw new Error('No credential returned from Google Auth');
      }

      const accessToken = credential.accessToken || '';
      
      // Extract refresh token from various possible properties in Firebase OAuth result
      const refreshToken = 
        (result as any)._tokenResponse?.refreshToken || 
        (result.user as any).refreshToken || 
        '';

      const { user } = result;

      // Create or update user profile in Firestore
      await firestoreService.createUser(
        user.uid,
        user.email || '',
        user.displayName || '',
        user.photoURL || ''
      );

      // Save tokens with expiration (typically 1 hour)
      const expiresAt = Date.now() + 3600000;
      await firestoreService.saveTokens(user.uid, accessToken, refreshToken, expiresAt);

      return { user, accessToken };
    } catch (error) {
      console.error('Error during Google Sign-In:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, callback);
  }

  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await firestoreService.getTokens(userId);
    if (!tokens) {
      throw new Error('NO_TOKENS');
    }

    // If token expires in less than 5 minutes (300,000 ms), refresh it
    if (tokens.expiresAt - Date.now() < 300000) {
      return this.refreshAccessToken(userId);
    }

    return tokens.accessToken;
  }

  async refreshAccessToken(userId: string): Promise<string> {
    const tokens = await firestoreService.getTokens(userId);
    if (!tokens || !tokens.refreshToken) {
      throw new Error('REAUTH_REQUIRED');
    }

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          refreshToken: tokens.refreshToken
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 401 && errorData.error === 'reauth_required') {
          throw new Error('REAUTH_REQUIRED');
        }
        throw new Error(errorData.error || 'token_refresh_failed');
      }

      const data = await res.json();
      return data.accessToken;
    } catch (err: any) {
      if (err.message === 'REAUTH_REQUIRED') {
        throw err;
      }
      console.error('Failed to refresh Google Access Token:', err);
      throw new Error('REAUTH_REQUIRED');
    }
  }
}

export const authService = new AuthService();
