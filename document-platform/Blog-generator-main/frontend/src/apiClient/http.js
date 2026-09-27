// Thin HTTP client for the web build. Holds the JWT and calls the Node backend.
// Mirrors what the Electron main process did, but over HTTP.

// API base can be EITHER an absolute origin (dev: http://localhost:4000) OR a same-origin
// path prefix for sub-path deploys (prod: "/blog-app", or "" for a domain root). Use ??
// so an explicit empty string ("same origin, root") is preserved.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'bg_access_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export function apiBase() {
  return API_BASE;
}

/** Build an absolute ws:// or wss:// URL for the given path, honouring API_BASE. */
export function wsUrl(path) {
  if (/^https?:\/\//i.test(API_BASE)) return API_BASE.replace(/^http/i, 'ws') + path;
  // Same-origin (path prefix or empty): derive ws origin from the current page.
  const origin = window.location.origin.replace(/^http/i, 'ws');
  return `${origin}${API_BASE}${path}`;
}

/** POST a channel payload to /api/<channel>, returning the parsed JSON result. */
export async function callChannel(channel, payload) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/${channel}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload ?? {}),
  });

  if (res.status === 401) {
    if (typeof onUnauthorized === 'function') onUnauthorized();
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (data == null) {
    return { success: false, error: `Empty response (HTTP ${res.status})` };
  }
  return data;
}
