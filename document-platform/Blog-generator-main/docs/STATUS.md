# Build status / checklist

Tracks what's wired vs pending as we port the 98 IPC handlers to the Node backend.

## Phase 0 — Scaffolding ✅ (this commit)
- [x] Project layout (`backend/`, `frontend/`, `desktop/`, `docker/`)
- [x] `.env.example`, `.gitignore`, README
- [x] Backend skeleton: Fastify + CORS + WebSocket, Mongo connection, JWT, health
- [x] Auth routes against the existing `users` collection (`login`, `setup-admin`, `get-auth-state`, `get-current-user`, `logout`)
- [x] `apiClient` adapter mirroring the full `window.electronAPI` surface (HTTP + WS)
- [x] Channel map (all ~100 methods) + 501 catch-all for unported channels
- [x] Docker compose (backend, worker, frontend/nginx, redis) — Mongo + S3 external

## Phase 1 — Backend core (data/settings/users/history/logs)  ✅
Ported the PHP/Mongo data layer (`db-actions.php` → `backend/src/db/actions.js`)
and wrapped each channel with per-request auth + permission context
(`backend/src/lib/context.js`).
- [x] data layer port `backend/src/db/actions.js` (blogs, users, settings, logs,
      activities, notifications, api_usage, publish_history, remote_posts,
      sessions/events) — faithful to PHP field maps
- [x] settings: `save-/get-api-key`, `save-/get-/update-settings`,
      `get-publish-destinations`, `get-/save-user-settings`, `get-/save-user-api-key`,
      server/mongodb config stubs (server-managed)
- [x] history/blogs: `get-history`, `get-blog`, `update-blog`, `delete-blog`, `clear-blogs`
- [x] users/admin: `list-users`, `create-user`, `update-user-access`, `change-user-password`, `delete-user`
- [x] logs/activities/notifications/api-usage: `get-activities`, `get-logs`(+activity merge),
      `get-logs-stats`, `get-logs-trend`, `clear-logs`, `get-/mark-/clear-notifications`, `get-api-usage`
- [x] publish history/analytics + remote-post reads + session/event tracking
- [x] Shopify OAuth client-secret crypto ported (`backend/src/lib/shopify-secrets.js`,
      byte-compatible with the desktop app so ciphertext is portable)
- [x] password hashing aligned to the desktop scheme (PBKDF2-SHA512, salted) so
      desktop + web verify the same credentials
- Deferred to later phases (still hit the 501 catch-all): `test-api-connection` &
  `list-provider-models` (Phase 3), live WordPress sync / remote-post detail (Phase 4),
  scheduler channels (Phase 5), app-update channels (Phase 6).
- ⚠ Run `cd backend && npm install` before `npm run dev` (deps not yet installed).

## Phase 2 — Frontend on the web  ✅ (wired; pending live run)
- [x] Copied renderer verbatim into `frontend/src` (App.jsx, i18n.js, index.css,
      13 components) — unchanged from the desktop renderer
- [x] `index.html`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js` (ESM),
      and `src/main.jsx` that imports the apiClient adapter **before** App
- [x] TinyMCE self-hosting via `scripts/copy-tinymce.js` (postinstall → `public/tinymce/`)
- [x] Verified all third-party imports (react, react-dom, recharts, react-date-range,
      date-fns, markdown-it, lucide-react) are in `frontend/package.json`; configs pass
      `node --check`
- [ ] Live smoke test in a browser (needs `npm install` in `frontend/` + a running
      backend): login → history → settings. The data routes they call are live as of
      Phase 1; generation/publishing/scheduler screens will surface 501s until Phases 3–5.

## Phase 3 — Generation + realtime  ✅ (wired; pending live run)
- [x] Reused `aiProviders.js` (self-contained, global `fetch`) and `productScraper.js`
      verbatim as `.cjs` in `backend/src/services/` — zero conversion risk
- [x] Ported the full `generate-blog` pipeline + all prompt templates + helpers to
      `backend/src/services/blogGenerator.js` (SEO research → sources → takeaways →
      outline → draft → repair → humanize → compliance → expand → finalize → autosave)
- [x] Progress streams over the user's WebSocket as `generation-progress` events
      (`emitToUser`), matching the renderer's `onGenerationProgress` listener
- [x] `generate-blog-image` ported (attaches to blog + gallery, tracks usage/logs)
- [x] `test-api-connection`, `list-provider-models`, `scrape-website`,
      `save-/get-product-database` (stored per-workspace in `settings`), `preview-link`
- [x] nginx `/api` proxy timeout raised to 600s for long generation requests
- Decision: interactive generation runs **in the backend process** (not the BullMQ
  worker) and streams progress over WS — the user is waiting anyway. The worker is
  reserved for the scheduler (Phase 5).
- Deferred to Phase 4: generated-image **persistence to S3** (currently the provider
  URL / base64 data-URL is stored on the blog as-is); puppeteer dynamic scraping
  (static axios+cheerio mode works; puppeteer is an optional, uninstalled dep).
- [ ] Live run: generate a blog end-to-end in the browser with a real API key.

## Phase 4 — Publishing + image storage  ✅ (wired; pending live run)
### 4a — done (wired; pending live run)
- [x] `backend/src/services/publishService.js` — ported all publish helpers + the
      dispatch for **WordPress / wordpress-token / custom / JTL / Shopify(direct token)**
- [x] `publish-blog`, `test-publish-destination`, records publish history + activity
- [x] Image storage = multipart POST to the user's configured `storage.endpointUrl`
      (NOT the AWS SDK — that's the existing mechanism). `upload-image-storage`,
      `test-image-storage` ported.
- [x] `list-/create-wordpress-categories`
- [x] **Closed the Phase 3 deferral:** `generate-blog-image` now offloads the
      generated image to the storage endpoint when enabled (hosted URL instead of a
      base64 data-URL), best-effort with fallback.
- [x] deps added: `form-data`, `mime-types`; nginx `/api` timeout already raised.

### 4b — Shopify server-side OAuth ✅ (wired; pending live run)
- [x] `lib/shopify-server-crypto.js` — AES-256-GCM, key = sha256(APP_ENCRYPTION_KEY ||
      JWT_SECRET), `enc:iv:tag:cipher` — byte-compatible with the PHP backend
- [x] `services/shopifyOauth.js` — ported the PHP `/shopify/*` design against the SAME
      collections (`shopify_oauth_clients`, `shopify_oauth_states`, `shopify_connections`):
      HMAC verify, token exchange, encrypted token storage, connection lookup
- [x] `routes/shopify.js`: `shopify-oauth-list/save/delete-client`, `start-shopify-oauth`,
      `shopify-oauth-status`, `list-/create-shopify-blog`, and the **public**
      `GET /api/auth/shopify/callback` (verifies + exchanges + stores + auto-close page)
- [x] On the web the Shopify redirect hits the backend callback **directly** (no desktop
      localhost bounce). `start-shopify-oauth` returns the authorize URL + state; the
      adapter opens a popup and polls `shopify-oauth-status`, so `SettingsPage` keeps its
      blocking-call contract unchanged.
- [x] `get-settings` now reports `shopifyServerOauthEnabled: true` + the redirect URL;
      `publish-blog` / `test-publish-destination` resolve the stored token server-side so
      the secret never reaches the client.
- env: `APP_ENCRYPTION_KEY`, `SHOPIFY_OAUTH_REDIRECT_URL` documented in `.env.example`.

### 4b — WordPress/Shopify sync ✅ (wired; pending live run)
- [x] `services/remoteSync.js` — WP + Shopify fetch/update/delete + status counts, plus
      orchestration: `syncRemotePosts` (fetch → `replaceRemotePosts` → bump publish
      history), `getRemotePostDetail`, `updateRemotePost`, `deleteRemotePost`,
      `getWordpressStats`, `testWordpressSync`
- [x] `routes/remote.js`: `sync-remote-posts`, `get-remote-post-detail`,
      `update-remote-post`, `delete-remote-post`, `get-wordpress-stats`,
      `test-wordpress-sync` — Shopify destinations get their token resolved server-side
- [x] added `updatePublishHistoryStatusByRemotePost` to the data layer
- Simplified vs desktop: `get-remote-post-detail` resolves the linked local blog via the
  direct `publish_history → blogs` lookup; the heavier URL/title heuristic fallback is
  omitted (best-effort enhancement only).

### 4c — exports / downloads ✅ (wired; pending live run)
- [x] `services/fileExporter.js` — ported the desktop exporter to generate bytes
      **in memory** (base64): Markdown, HTML, DOCX (`docx`), CSV, and ZIP (`jszip`),
      plus a history-images ZIP (fetches each image server-side)
- [x] `routes/exports.js`: `export-blog`, `export-bulk` (ZIP), `export-history-csv`,
      `export-history-images` (ZIP), `download-image` (server fetch → base64),
      `attach-local-blog-image` (data-URL → optional storage upload → blog gallery)
- [x] Adapter overrides (browser-native): `triggerDownload` (base64 → Blob → click),
      `exportBlog`/`exportBulk`/`exportHistoryCsv`/`exportHistoryImages`/`downloadImage`
      download the returned bytes; `selectLocalImageFile` uses a real `<input type=file>`
      returning a data-URL; **PDF** opens a print window (browser "Save as PDF") since
      there's no Electron `printToPDF` server-side
- [x] deps added: `docx`, `markdown-it`, `jszip`
- Limitation: **bulk PDF** isn't supported on the web (browser print is per-document) —
      returns a clear error; export individually or pick MD/HTML/DOCX.

## Phase 5 — Scheduler worker  ✅ (wired; pending live run)
- [x] `services/schedulerService.js` — ported the PHP `/scheduler/*` CRUD against the
      same `scheduler_jobs` / `scheduler_logs` collections, plus the desktop job
      `normalize` + due-check + a CSV importer; worker helpers (`listDueJobs`,
      `listStaleRunningJobs`, `setJobStatus`, `addWorkerLog`)
- [x] `routes/scheduler.js` — all 8 channels (`scheduler-list-jobs`,
      `-list-history-blogs`, `-create-job`, `-update-job`, `-delete-job`, `-import-csv`,
      `-list-logs`, `-add-log`), scoped to the workspace owner
- [x] `worker/schedulerRunner.js` — the executor: polls due jobs across **all** users
      and runs each in its owner's context — generate (or load existing blog) → optional
      image (with storage offload) → optional auto-publish (resolving Shopify tokens) →
      record publish history → update job status → write scheduler logs. Stale-running
      recovery included.
- [x] `worker/index.js` now connects Mongo and starts the poll runner (default 30s).
- Decision: a **DB-poll runner** (mirrors the desktop tick) rather than BullMQ — no Redis
  dependency needed for the scheduler; the `worker` compose service runs it. BullMQ/Redis
  remain available for future per-job scheduling.

## Phase 6 — Desktop shell  ✅ (scaffolded; needs icons + signing for release)
- [x] `desktop/main.js` — thin Electron shell: `BrowserWindow` loads the deployed web
      app (`APP_URL`), opens external links in the browser, keeps navigation within the
      app origin, and silently auto-updates **itself** via `electron-updater` (launch + 6h)
- [x] `desktop/preload.js` — exposes only a `window.__desktopShell` marker; the web app
      keeps its own HTTP/WS `window.electronAPI`
- [x] `desktop/package.json` — `electron-builder` config for Windows (nsis) + macOS (dmg),
      generic update feed via `UPDATE_FEED_URL`
- [x] App-update channels handled in the **adapter** (browser-appropriate no-ops):
      `get-app-version`, `check-app-update` (no update), `download-/install-app-update`
      report that the web app updates automatically
- Before a signed release: add `build/icon.ico` + `build/icon.icns`, set `UPDATE_FEED_URL`,
  and configure code-signing/notarization per electron-builder.

## Phase 7 — Hardening  🟡 (baseline done)
- [x] **Security headers** via `@fastify/helmet`
- [x] **Rate limiting** via `@fastify/rate-limit` (per-IP, `trustProxy` for X-Forwarded-For;
      `/ws` + `/health` exempt; tunable via `RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW`)
- [x] **NoSQL-injection guard** on auth: `username`/`password` coerced to strings so a
      `{"$ne":null}` body can't smuggle a Mongo operator into the query
- [x] **Global error handler** — no stack-trace leaks; keeps `{success,error}` contract
- [x] **Graceful shutdown** — `app.close()` + `closeMongo()` on SIGTERM/SIGINT (both API
      and worker)
- [x] **WebSocket hub hardened** — version-agnostic socket resolution, error/close cleanup
- [x] **CORS** already allowlist-driven (`CORS_ORIGINS`)
- Remaining (ops, not code): per-route tighter limits on login/generate, full request-body
  validation (zod) on every channel, structured metrics/tracing, DB backups, load test.

---

## Live-run checklist (the one thing not yet executed)
1. `cd Blog-generator && cp .env.example .env` — set `MONGODB_URI`, `JWT_SECRET` (match
   PHP), `PUBLIC_API_URL`, optionally `APP_ENCRYPTION_KEY`.
2. `cd backend && npm install && npm run dev` → check `GET /health/db`.
3. `cd ../frontend && npm install && npm run dev` → open http://localhost:5173.
4. Verify: login → settings → history → **generate a blog** (watch WS progress) →
   **publish** → **create a schedule** (then `cd ../backend && npm run worker` or
   `node src/worker/index.js` to execute it).
5. `docker compose up --build` for the full containerized stack (nginx + backend + worker
   + redis); Mongo + S3/upload endpoint are external.
