export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('No token found');
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, { ...options, headers });

  // If unauthorized, attempt to refresh token
  if (response.status === 401) {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        const refreshRes = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          token = data.data.accessToken;
          const newRefreshToken = data.data.refreshToken;
          
          localStorage.setItem('token', token!);
          localStorage.setItem('refreshToken', newRefreshToken);
          
          // Retry original request with new token
          headers.set('Authorization', `Bearer ${token}`);
          response = await fetch(url, { ...options, headers });
        } else {
          // Refresh failed, clear local storage
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
    } else {
      localStorage.removeItem('token');
    }
  }

  return response;
}
