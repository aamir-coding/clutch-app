import { authService } from '../firebase/auth';

export async function googleFetch(
  userId: string,
  url: string,
  options?: RequestInit
): Promise<Response> {
  let accessToken = await authService.getValidAccessToken(userId);

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
    Authorization: `Bearer ${accessToken}`
  };

  let response = await fetch(url, {
    ...options,
    headers: mergedHeaders
  });

  if (response.status === 401) {
    console.warn('Google Access Token expired, attempting to refresh...');
    try {
      accessToken = await authService.refreshAccessToken(userId);
      
      const retryHeaders = {
        ...mergedHeaders,
        Authorization: `Bearer ${accessToken}`
      };

      response = await fetch(url, {
        ...options,
        headers: retryHeaders
      });
    } catch (err) {
      console.error('Retrying fetch after refresh failed:', err);
    }
  }

  return response;
}

export function buildGoogleUrl(
  base: string,
  params: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(base);
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined) {
      url.searchParams.set(key, String(val));
    }
  });
  return url.toString();
}
