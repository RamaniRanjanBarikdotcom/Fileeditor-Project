# Blog-generator (Web + Desktop platform)

Server-side, web-based rebuild of the AI Blog Generator. Runs in a browser and as an
installable desktop app (Electron shell) — both talk to the **same Node backend**, so
all logic runs server-side. The React UI and feature set are reused from the existing
Electron app; only the API transport (HTTP/WebSocket) and image storage (AWS S3) change.

See the architecture plan in the existing repo: `aibloggenerator-copy-4/docs/web-platform-plan.md`.

## Layout

```
backend/    Node (Fastify) API + job worker — ports the Electron main-process logic
frontend/   React app (copied from the Electron renderer) + apiClient adapter
desktop/    Electron thin shell that loads the web app (Phase 6)
docker/     Dockerfiles + nginx config
docker-compose.yml
.env.example
```

## Decisions (locked)

- **Backend:** all-Node, talks directly to the existing MongoDB.
- **Auth:** JWT (HS256) — same `JWT_SECRET` as the PHP API so existing users/tokens work.
- **Storage:** AWS S3 (`@aws-sdk/client-s3`) with pre-signed URLs.
- **Desktop:** Electron thin shell (reuses the existing auto-update flow later).
- **Database:** the same MongoDB as the current app (shared data).

## The reuse strategy

The Electron renderer only ever calls `window.electronAPI.<method>()`. The web build keeps
every component unchanged and provides `frontend/src/apiClient` which exposes the **same
method names** over HTTP + WebSocket, then sets `window.electronAPI = apiClient`. The backend
exposes one route per former IPC channel (`/api/<channel>`).

## Status

Phase 0 scaffolding. See `docs/STATUS.md` for the running checklist of what's wired vs pending.

## Quick start (dev)

```bash
cp .env.example .env            # fill MONGODB_URI, JWT_SECRET, AWS creds, etc.
cd backend && npm install && npm run dev     # API on :4000
# frontend: see frontend/README.md (copy renderer, then `npm run dev`)
```

Or with Docker:

```bash
docker compose up --build
```
