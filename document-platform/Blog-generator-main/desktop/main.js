// Thin Electron shell for the Blog Generator web platform.
//
// It loads the DEPLOYED web app (APP_URL) in a native window — all logic stays
// server-side, exactly like the browser. The only native additions are:
//   • a real desktop window + menu
//   • silent background auto-update of THIS shell (electron-updater)
//   • opening external links in the user's browser
//
// The web app provides its own window.electronAPI (HTTP/WS adapter), so this shell
// deliberately exposes no API surface of its own — it's just a packaged browser.

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Which server this installer points at. Resolution order:
//   1) APP_URL env var (handy for dev: `APP_URL=http://localhost:5173 npm start`)
//   2) config.json next to this file (edit it, then build — this is the normal way)
//   3) localhost fallback
// config.json is bundled into the installer, so the built .exe/.dmg "just works".
function resolveAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    if (cfg && typeof cfg.appUrl === 'string' && cfg.appUrl.trim()) return cfg.appUrl.trim();
  } catch {
    /* no config.json — fall through */
  }
  return 'http://localhost:8080';
}
const APP_URL = resolveAppUrl();

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Blog Generator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The app talks to its backend over HTTPS/WSS; no extra privileges needed.
    },
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open target=_blank / external links in the default browser, not a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Keep in-app navigation within APP_URL's origin; send anything else to the browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const base = new URL(APP_URL);
      if (target.origin !== base.origin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      /* ignore malformed URLs */
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdate() {
  // Only meaningful in packaged builds with a configured update feed.
  if (!app.isPackaged) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', () => {
    // Install on next quit; electron-updater also surfaces a native prompt.
    autoUpdater.quitAndInstall(true, false);
  });
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  // Re-check every 6 hours while the app stays open.
  setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 6 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenu()));
  createWindow();
  setupAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function buildMenu() {
  const isMac = process.platform === 'darwin';
  return [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
}
