/**
 * Server-side Google API fetch helper.
 *
 * Uses the Admin Firestore SDK for token retrieval and storage — not the
 * client SDK — because this module runs exclusively inside Next.js API routes
 * where no Firebase Auth session exists and client-SDK security rules would
 * deny every Firestore read.
 *
 * Token refresh is performed directly against Google's OAuth endpoint rather
 * than through the /api/auth/refresh Next.js route, because making an HTTP
 * call from one API route to another (relative URL, no known base) hangs.
 */

import { adminFirestoreService } from '../firebase/adminFirestore';

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getValidAccessToken(userId: string): Promise<string> {
  const tokens = await adminFirestoreService.getTokens(userId);
  if (!tokens) {
    throw new Error('NO_TOKENS: no Google OAuth tokens found for this user. Re-authentication required.');
  }

  // Refresh if the token expires within the next 5 minutes.
  if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
    return refreshGoogleAccessToken(userId, tokens.refreshToken);
  }

  return tokens.accessToken;
}

async function refreshGoogleAccessToken(userId: string, refreshToken: string): Promise<string> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'REAUTH_REQUIRED: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables are not configured.'
    );
  }
  if (!refreshToken) {
    throw new Error('REAUTH_REQUIRED: no refresh token stored for this user.');
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type:    'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Google OAuth token refresh failed:', data);
    throw new Error(data.error === 'invalid_grant' ? 'REAUTH_REQUIRED' : 'token_refresh_failed');
  }

  const { access_token, expires_in } = data as { access_token: string; expires_in: number };
  const expiresAt = Date.now() + expires_in * 1000;

  // Persist the refreshed token via Admin SDK.
  await adminFirestoreService.saveAccessToken(userId, access_token, expiresAt);

  return access_token;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function googleFetch(
  userId: string,
  url: string,
  options?: RequestInit
): Promise<Response> {
  let accessToken = await getValidAccessToken(userId);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
    Authorization: `Bearer ${accessToken}`,
  };

  let response = await fetch(url, { ...options, headers });

  // On a 401, attempt a single forced refresh and retry.
  if (response.status === 401) {
    console.warn('Google API returned 401 — attempting forced token refresh...');
    try {
      const tokens = await adminFirestoreService.getTokens(userId);
      if (!tokens?.refreshToken) throw new Error('REAUTH_REQUIRED');
      accessToken = await refreshGoogleAccessToken(userId, tokens.refreshToken);
      response = await fetch(url, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${accessToken}` },
      });
    } catch (refreshErr) {
      console.error('Forced token refresh failed:', refreshErr);
      // Return the original 401 so the caller can surface it.
    }
  }

  return response;
}

export function buildGoogleUrl(
  base: string,
  params: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(base);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) url.searchParams.set(key, String(val));
  }
  return url.toString();
}