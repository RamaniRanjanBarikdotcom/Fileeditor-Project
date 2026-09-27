// Minimal preload. The web app installs its own window.electronAPI (an HTTP/WS adapter),
// so the shell intentionally exposes almost nothing — just a marker the web app can use
// to detect it's running inside the desktop shell, if it ever wants to.
const { contextBridge } = require('electron');

try {
  contextBridge.exposeInMainWorld('__desktopShell', {
    isDesktop: true,
    platform: process.platform,
  });
} catch {
  /* contextBridge unavailable — ignore */
}
