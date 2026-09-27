# Desktop shell

A thin **Electron** wrapper that loads the deployed web app (`APP_URL`) in a native
window and adds silent auto-update. All logic stays server-side — this is just a
packaged browser, so the desktop and web builds are always feature-identical.

## Files
- `main.js` — creates the `BrowserWindow` that loads `APP_URL`, opens external links in
  the user's browser, keeps navigation within the app origin, and (in packaged builds)
  checks for shell updates via `electron-updater` on launch + every 6h.
- `preload.js` — exposes only a `window.__desktopShell` marker. The web app installs its
  own `window.electronAPI` (the HTTP/WS adapter), so the shell adds no API surface.
- `package.json` — `electron-builder` config for Windows (nsis) and macOS (dmg).

## Run (dev)
```
cd desktop
npm install
APP_URL=http://localhost:5173 npm start    # point at the running frontend (or :8080 prod)
```

## Build installers
```
# set the update feed the installer will check (electron-updater "generic" provider)
export UPDATE_FEED_URL=https://downloads.example.com/blog-generator/
npm run dist:win     # Windows .exe (nsis)
npm run dist:mac     # macOS .dmg (x64 + arm64)
```
Place `build/icon.ico` (Windows) and `build/icon.icns` (macOS) before building. For
signed/notarized releases, add code-signing env/config per electron-builder docs.

## How updates work
- **The web app itself** is always current — a reload loads the latest deployed build.
  The Settings → Updates tab reflects this ("web build, automatic").
- **The shell** updates itself silently in the background (electron-updater), so users
  always run the latest wrapper without manual steps. Publish new installers + the
  `latest.yml`/`latest-mac.yml` manifests to `UPDATE_FEED_URL`.
