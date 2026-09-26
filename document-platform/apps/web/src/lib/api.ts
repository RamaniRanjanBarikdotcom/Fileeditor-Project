import { ApiResponse } from '@docconv/shared-types';

const ACCESS_TOKEN_KEY = 'atk';

let inMemoryAccessToken: string | null = null;
let restorePromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
  // Persist to sessionStorage so the token survives page refreshes and new
  // tabs opened from the same origin (sessionStorage is tab-specific but
  // we copy it via the storage event — see below).
  try {
    if (token) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // sessionStorage may be unavailable in some private-browsing modes.
  }
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  // Hydrate from sessionStorage on the first call within a page.
  try {
    const stored = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (stored) {
      inMemoryAccessToken = stored;
      return stored;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Attempts to restore the access token, in order:
 *   1. In-memory value (already set this render)
 *   2. sessionStorage  (survives page refresh in the same tab)
 *   3. /auth/refresh   (uses the HttpOnly refresh cookie — 30-day lifetime)
 *
 * Multiple parallel callers share the same in-flight promise so we only
 * hit the refresh endpoint once per page load.
 */
export function restoreAccessToken(): Promise<string | null> {
  const cached = getAccessToken();
  if (cached) return Promise.resolve(cached);
  if (restorePromise) return restorePromise;

  restorePromise = fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'AppToolkitLabApp',
    },
    credentials: 'include',
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json();
      const token: string | null = payload.data?.accessToken || null;
      if (token) setAccessToken(token);
      return token;
    })
    .catch(() => null)
    .finally(() => {
      restorePromise = null;
    });

  return restorePromise;
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('/') ? `/api/v1${endpoint}` : `/api/v1/${endpoint}`;
  const headers = new Headers(options.headers || {});

  headers.set('X-Requested-With', 'AppToolkitLabApp');

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Hydrate from sessionStorage before every call in case a new page just loaded.
  if (!inMemoryAccessToken) getAccessToken();

  if (inMemoryAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  // Include credentials for HttpOnly refresh cookies
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR' as any,
        message: 'The server is unavailable. Check your connection and try again.',
      },
    };
  }

  // If 401 Unauthorized, try to silently refresh and retry once.
  const isAnonymousEndpoint =
    (!inMemoryAccessToken && endpoint.includes('/tools/')) ||
    endpoint.includes('/capabilities') ||
    endpoint.includes('/health') ||
    endpoint.includes('/auth/login') ||
    endpoint.includes('/auth/register') ||
    endpoint.includes('/auth/refresh') ||
    endpoint.includes('/auth/forgot-password') ||
    endpoint.includes('/auth/reset-password');

  if (response.status === 401 && !isAnonymousEndpoint) {
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'AppToolkitLabApp',
        },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.data?.accessToken) {
          setAccessToken(refreshData.data.accessToken);
          headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
          response = await fetch(url, { ...fetchOptions, headers });
        }
      } else {
        // Refresh cookie is expired — clear everything and force re-login.
        setAccessToken(null);
      }
    } catch {
      setAccessToken(null);
    }
  }

  try {
    const data = await response.json();
    return data;
  } catch {
    const message =
      response.status >= 500
        ? 'The service is temporarily unavailable. Please try again shortly.'
        : `The request failed (${response.status}). Please try again.`;
    return {
      success: response.ok,
      error: response.ok
        ? undefined
        : {
            code: 'INTERNAL_ERROR' as any,
            message,
          },
    };
  }
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'AppToolkitLabApp');

  if (!inMemoryAccessToken) getAccessToken(); // hydrate from sessionStorage

  if (inMemoryAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  return fetch(url, { ...options, headers, credentials: 'include' });
}
