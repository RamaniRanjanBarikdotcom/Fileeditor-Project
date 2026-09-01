import { ApiResponse } from '@docconv/shared-types';

let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('/') ? `/api/v1${endpoint}` : `/api/v1/${endpoint}`;
  const headers = new Headers(options.headers || {});

  headers.set('X-Requested-With', 'ToolSuiteApp');

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (inMemoryAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  // Include credentials for HttpOnly refresh cookies
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  let response = await fetch(url, fetchOptions);

  // If 401 Unauthorized, try to refresh token automatically
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'ToolSuiteApp',
        },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.data?.accessToken) {
          inMemoryAccessToken = refreshData.data.accessToken;
          headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
          response = await fetch(url, { ...fetchOptions, headers });
        }
      } else {
        inMemoryAccessToken = null;
      }
    } catch {
      inMemoryAccessToken = null;
    }
  }

  try {
    const data = await response.json();
    return data;
  } catch {
    return {
      success: response.ok,
      error: response.ok
        ? undefined
        : { code: 'INTERNAL_ERROR' as any, message: `HTTP ${response.status}: ${response.statusText}` },
    };
  }
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'ToolSuiteApp');

  if (inMemoryAccessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  return fetch(url, { ...options, headers, credentials: 'include' });
}
