# Frontend (web build)

Reuses the existing Electron renderer **unchanged**. The only new code is
`src/apiClient/`, which re-implements `window.electronAPI` over HTTP + WebSocket.
`src/main.jsx` imports the adapter **first** so `window.electronAPI` exists before any
component mounts.

## What's here

- `src/App.jsx`, `src/i18n.js`, `src/index.css`, `src/components/*` — copied verbatim
  from `aibloggenerator-copy-4/src/renderer/src` (do **not** edit here; re-copy if the
  desktop renderer changes).
- `src/apiClient/` — the HTTP/WS adapter (`channels.js`, `http.js`, `index.js`).
- `src/main.jsx`, `index.html`, `vite.config.js`, `tailwind.config.js`,
  `postcss.config.js` — web entry + build config.
- `scripts/copy-tinymce.js` — self-hosts TinyMCE into `public/tinymce/` on
  `postinstall` (EditBlogPage loads `./tinymce/tinymce.min.js`). The folder is
  git-ignored and regenerated from `node_modules/tinymce`.

### Re-syncing the renderer after desktop changes

```
# from Blog-generator/frontend
cp    ../../aibloggenerator-copy-4/src/renderer/src/App.jsx     ./src/App.jsx
cp    ../../aibloggenerator-copy-4/src/renderer/src/i18n.js     ./src/i18n.js
cp    ../../aibloggenerator-copy-4/src/renderer/src/index.css   ./src/index.css
cp -r ../../aibloggenerator-copy-4/src/renderer/src/components  ./src/components
```

## Why components don't change

Every component calls `window.electronAPI.<method>()`. The adapter exposes the same
methods, so the components are byte-for-byte reusable. As browser-native flows are
ported (file pickers, downloads, S3 uploads), only `src/apiClient/index.js` changes —
never the components.

## Env

```
VITE_API_BASE_URL=http://localhost:4000   # the Node backend (CORS-enabled for :5173)
```

## Run

```
npm install            # also copies TinyMCE into public/ via postinstall
npm run dev            # http://localhost:5173  (start the backend on :4000 first)
```

Build for production: `npm run build` → `dist/` (served by nginx in Docker, which also
proxies `/api` and `/ws` to the backend).
