import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';

const refreshSchema = z.object({
  userId: z.string(),
  refreshToken: z.string()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = refreshSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { userId, refreshToken } = result.data;

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_FIREBASE_API_KEY; // Fallback or direct check
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth client credentials in environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const googleRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const googleData = await googleRes.json();

    if (!googleRes.ok) {
      console.error('Google token refresh error:', googleData);
      if (googleData.error === 'invalid_grant') {
        return NextResponse.json({ error: 'reauth_required' }, { status: 401 });
      }
      return NextResponse.json({ error: 'token_refresh_failed' }, { status: googleRes.status || 500 });
    }

    const accessToken = googleData.access_token;
    const expiresIn = googleData.expires_in; // in seconds
    const expiresAt = Date.now() + expiresIn * 1000;

    if (!adminDb) {
      throw new Error('Firebase Admin DB is not initialized');
    }

    // Update the tokens in Firestore
    await adminDb.collection('users').doc(userId).update({
      'tokens.accessToken': accessToken,
      'tokens.expiresAt': expiresAt
    });

    return NextResponse.json({ accessToken, expiresAt }, { status: 200 });
  } catch (err: any) {
    console.error('Error refreshing token in API route:', err);
    return NextResponse.json({ error: 'token_refresh_failed' }, { status: 500 });
  }
}
