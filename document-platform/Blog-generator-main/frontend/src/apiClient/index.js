// Builds an object with the SAME surface as the Electron `window.electronAPI`,
// but backed by HTTP + WebSocket. Importing this for its side effect sets
// window.electronAPI so the copied React components run unchanged.

import { CHANNELS } from './channels.js';
import { callChannel, getToken, setToken, setUnauthorizedHandler, wsUrl } from './http.js';

// ── WebSocket for server-pushed events (replaces IPC events) ───────────────
const wsListeners = {
  'auth-expired': new Set(),
  'generation-progress': new Set(),
  'scheduler-update': new Set(),
};
let ws = null;

function ensureWs() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const token = getToken();
  if (!token) return;
  ws = new WebSocket(wsUrl(`/ws?token=${encodeURIComponent(token)}`));
  ws.onmessage = (msg) => {
    try {
      const { event, payload } = JSON.parse(msg.data);
      wsListeners[event]?.forEach((cb) => cb(payload));
    } catch {
      /* ignore malformed */
    }
  };
  ws.onclose = () => {
    ws = null;
    setTimeout(ensureWs, 3000); // reconnect
  };
}

function subscribe(event, cb) {
  wsListeners[event]?.add(cb);
  ensureWs();
  return () => wsListeners[event]?.delete(cb);
}

// ── Build the adapter ──────────────────────────────────────────────────────
const api = {};

// Generic request/response channels → POST /api/<channel>
for (const [method, channel] of Object.entries(CHANNELS)) {
  api[method] = (payload) => callChannel(channel, payload);
}

// Capture the JWT returned by login/setup so subsequent calls are authenticated.
const wrapAuth = (fn) => async (payload) => {
  const result = await fn(payload);
  if (result?.auth?.accessToken) {
    setToken(result.auth.accessToken);
    ensureWs();
  }
  return result;
};
api.login = wrapAuth((p) => callChannel(CHANNELS.login, p));
api.setupAdmin = wrapAuth((p) => callChannel(CHANNELS.setupAdmin, p));
api.logout = async () => {
  const r = await callChannel(CHANNELS.logout, {});
  setToken('');
  return r;
};

// ── Browser-native overrides (things Electron did natively) ────────────────
api.openExternal = async ({ url } = {}) => {
  if (url) window.open(url, '_blank', 'noopener');
  return { success: true };
};

// Right-click handling is native browser behaviour on the web; no-op.
api.showLinkContextMenu = async () => ({ success: true });

// Shopify OAuth is server-side: the backend returns an authorize URL; we open it in a
// popup and poll status until the callback completes. This mirrors the blocking
// desktop call so SettingsPage stays unchanged (it just awaits a connected result).
api.startShopifyOAuth = async (payload) => {
  const res = await callChannel(CHANNELS.startShopifyOAuth, payload);
  if (!res?.success || !res.authorizeUrl || !res.state) return res;
  const popup = window.open(res.authorizeUrl, 'shopify-oauth', 'width=620,height=760');
  const state = res.state;
  const deadline = Date.now() + 5 * 60 * 1000;
  const closePopup = () => {
    try {
      if (popup && !popup.closed) popup.close();
    } catch {
      /* ignore */
    }
  };
  return new Promise((resolve) => {
    const tick = async () => {
      if (Date.now() > deadline) {
        closePopup();
        resolve({ success: false, error: 'Shopify authorization timed out. Please try again.' });
        return;
      }
      let st = null;
      try {
        st = await callChannel(CHANNELS.shopifyOauthStatus, { state });
      } catch {
        /* transient; keep polling */
      }
      if (st?.status === 'complete') {
        closePopup();
        resolve({ success: true, serverManaged: true, shopDomain: res.shopDomain || st.shop, apiVersion: res.apiVersion });
        return;
      }
      if (st?.status === 'failed') {
        closePopup();
        resolve({ success: false, error: st.error || 'Shopify authorization failed.' });
        return;
      }
      setTimeout(tick, 1500);
    };
    setTimeout(tick, 1500);
  });
};

// ── Export / download / local-file flows (browser-native) ──────────────────
// The backend returns base64 file bytes; here we turn them into browser downloads.
async function triggerDownload(name, mimeType, base64) {
  const blob = await (await fetch(`data:${mimeType || 'application/octet-stream'};base64,${base64}`)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function openPrintWindow(base64) {
  const html = await (await fetch(`data:text/html;base64,${base64}`)).text();
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the browser a moment to lay out before invoking the print/Save-as-PDF dialog.
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  }, 400);
}

api.exportBlog = async (payload) => {
  const res = await callChannel(CHANNELS.exportBlog, payload);
  if (!res?.success || !Array.isArray(res.files)) return res;
  for (const f of res.files) {
    if (f.format === 'pdf') await openPrintWindow(f.base64);
    else await triggerDownload(f.name, f.mime, f.base64);
  }
  return { success: true, files: res.files.map((f) => f.name) };
};

api.exportBulk = async (payload) => {
  const res = await callChannel(CHANNELS.exportBulk, payload);
  if (res?.success && res.zip) await triggerDownload(res.zip.name, res.zip.mime, res.zip.base64);
  return res;
};

api.exportHistoryCsv = async (payload) => {
  const res = await callChannel(CHANNELS.exportHistoryCsv, payload);
  if (res?.success && res.file) await triggerDownload(res.file.name, res.file.mime, res.file.base64);
  return res;
};

api.exportHistoryImages = async (payload) => {
  const res = await callChannel(CHANNELS.exportHistoryImages, payload);
  if (res?.success && res.zip) await triggerDownload(res.zip.name, res.zip.mime, res.zip.base64);
  return res;
};

api.downloadImage = async (payload) => {
  const res = await callChannel(CHANNELS.downloadImage, payload);
  if (res?.success && res.file) await triggerDownload(res.file.name, res.file.mime, res.file.base64);
  return res;
};

// Native file picker → return the chosen image as a data-URL (used as "localImagePath"
// by attach-local-blog-image, which the backend treats as the image source).
api.selectLocalImageFile = () =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) {
        resolve({ success: false, canceled: true });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ success: true, path: reader.result, dataUrl: reader.result, name: file.name });
      reader.onerror = () => resolve({ success: false, error: 'Failed to read file' });
      reader.readAsDataURL(file);
    };
    // If the dialog is dismissed without choosing, we simply never resolve — matches
    // the desktop "canceled" path closely enough for the UI (no pending spinner state).
    input.click();
  });

// ── App updates ────────────────────────────────────────────────────────────
// The web app is always current (a reload gets the latest build), and the desktop
// shell updates itself silently via electron-updater. So these are no-ops that keep
// the Settings "Updates" tab happy without hitting the backend.
const WEB_VERSION = import.meta.env.VITE_APP_VERSION || 'web';
api.getAppVersion = async () => ({ success: true, version: WEB_VERSION });
api.checkAppUpdate = async ({ currentVersion = '' } = {}) => ({
  success: true,
  isUpdateAvailable: false,
  currentVersion: currentVersion || WEB_VERSION,
  latestVersion: currentVersion || WEB_VERSION,
  update: null,
  channel: 'web',
});
api.downloadAppUpdate = async () => ({ success: false, error: 'The web app updates automatically — no download needed.' });
api.installAppUpdate = async () => ({ success: false, error: 'The web app updates automatically — no install needed.' });

// Event subscriptions move to WebSocket.
api.onAuthExpired = (cb) => subscribe('auth-expired', cb);
api.onGenerationProgress = (cb) => subscribe('generation-progress', cb);
api.onSchedulerUpdate = (cb) => subscribe('scheduler-update', cb);

// TODO (Phase 3/4): browser-native file flows that Electron did with dialogs.
//   selectLocalImageFile  -> <input type=file> picker, return {dataUrl, name}
//   download*/export*     -> trigger a browser download from the returned URL
//   uploadImageToStorage  -> multipart upload (pre-signed S3) instead of base64 IPC
// These are left mapped to the server above; override here as each is ported.

setUnauthorizedHandler(() => {
  wsListeners['auth-expired'].forEach((cb) => cb());
});

if (typeof window !== 'undefined') {
  window.electronAPI = api;
}

export default api;
