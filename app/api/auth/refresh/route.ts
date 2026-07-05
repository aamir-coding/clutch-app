import { NextRequest, NextResponse } from 'next/server';
import { z }       from 'zod';
import { adminDb } from '@/lib/firebase/admin';

const refreshSchema = z.object({
  userId:       z.string().min(1),
  refreshToken: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json();
    const parse = refreshSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid request body — userId and refreshToken are required.' },
        { status: 400 }
      );
    }

    const { userId, refreshToken } = parse.data;

    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    // Do NOT fall back to NEXT_PUBLIC_FIREBASE_API_KEY here.
    // That is a Firebase project API key — a completely different credential
    // from the Google OAuth client ID. Using it as an OAuth client ID causes
    // Google to return `invalid_client` and silently breaks all token refreshes.
    if (!clientId || !clientSecret) {
      console.error(
        'Token refresh failed: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set.'
      );
      return NextResponse.json(
        { error: 'Server OAuth configuration error — contact the administrator.' },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    });

    const googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      console.error('Google token refresh error:', googleData);

      if (googleData.error === 'invalid_grant') {
        // The refresh token has been revoked or expired.
        // The client must re-authenticate via the Google sign-in popup.
        return NextResponse.json({ error: 'reauth_required' }, { status: 401 });
      }

      return NextResponse.json(
        { error: 'token_refresh_failed' },
        { status: googleRes.status || 500 }
      );
    }

    const accessToken = googleData.access_token as string;
    const expiresIn   = googleData.expires_in   as number; // seconds
    const expiresAt   = Date.now() + expiresIn * 1000;

    // Persist the refreshed access token via the Admin SDK.
    // Using Admin SDK here because this route may be called from the browser
    // (lib/firebase/auth.ts → AuthService.refreshAccessToken) while the user
    // is signed in, but Firestore client-SDK rules require Auth context which
    // may have already expired — the Admin SDK bypasses that.
    if (!adminDb) {
      // Graceful degradation: return the token even if we can't persist it.
      // The client will use it immediately; the next call will refresh again.
      console.warn('Firebase Admin DB not initialized — token not persisted to Firestore.');
      return NextResponse.json({ accessToken, expiresAt }, { status: 200 });
    }

    await adminDb.collection('users').doc(userId).update({
      'tokens.accessToken': accessToken,
      'tokens.expiresAt':   expiresAt,
    });

    return NextResponse.json({ accessToken, expiresAt }, { status: 200 });

  } catch (err: any) {
    console.error('Unexpected error in /api/auth/refresh:', err);
    return NextResponse.json({ error: 'token_refresh_failed' }, { status: 500 });
  }
}