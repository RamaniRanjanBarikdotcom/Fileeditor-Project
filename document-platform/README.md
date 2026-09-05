# AppToolkitLab

AppToolkitLab is a Gonexel product built with Next.js, NestJS, and a separate Node.js conversion worker. It supports multiple runtime modes without changing application code:

- **Docker mode:** every service runs in Docker Compose.
- **Node/hybrid mode:** Next.js, NestJS, and the worker run directly in Node.js; only infrastructure runs in Docker.
- **Managed Node/Hostinger mode:** Next.js and NestJS run as Node processes; browser-capable tools need no Docker or native converter.
- **Fully native mode:** all Node processes and infrastructure services are installed directly on a VPS.

## Project execution memory

All implementation tasks, statuses, decisions, verification evidence, cleanup candidates, and session handoffs must be recorded in [`docs/PROJECT_EXECUTION_MEMORY.md`](docs/PROJECT_EXECUTION_MEMORY.md). Only tasks marked `VERIFIED` in that ledger should be treated as completed.

## Requirements

- Node.js 20 or newer
- Corepack (included with Node.js)
- A PostgreSQL database for accounts, commerce, subscriptions, and metadata
- Redis 7+, MinIO/S3, Gotenberg 8, Pandoc, Poppler and Tesseract only when server conversion workers are enabled

Worker dependencies on macOS:

```bash
brew install pandoc poppler tesseract
```

Worker dependencies on Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y pandoc poppler-utils tesseract-ocr
```

## First-time installation

Run commands from the `document-platform` directory:

```bash
corepack enable
corepack pnpm install
cp .env.example .env
```

Review `.env` and replace the development secrets before using a public server.

## 1. Hybrid Development (Recommended for local dev)

This runs the dependencies (Postgres, Redis, MinIO, Gotenberg) in Docker, but runs the API, Worker, and Web natively on your machine via Node.js.

```bash
# Stops Docker app containers if necessary, starts the four infrastructure
# containers, initializes the database, and runs all Node apps in parallel.
corepack pnpm run hybrid:dev
```

Open <http://localhost:5173>. Stop the foreground Node processes with `Ctrl+C`;
the infrastructure containers can be stopped with `corepack pnpm infra:down`.

## 2. Managed Node / Hostinger (No Docker)

This mode serves the public website, PostgreSQL-backed account/API features, and every tool marked
**Private browser processing**. It deliberately disables native-only processing and never silently
uploads a file selected for local processing.

```bash
corepack pnpm install
cp .env.example .env

# Configure DATABASE_URL and production secrets, then:
corepack pnpm hostinger:doctor
corepack pnpm node:setup
corepack pnpm hostinger:build
corepack pnpm hostinger:start
```

Set these values in the hosting control panel:

```dotenv
DEPLOYMENT_MODE=HOSTINGER
PROCESSING_BROWSER_ENABLED=true
PROCESSING_NODE_ENABLED=true
PROCESSING_NATIVE_ENABLED=false
REDIS_ENABLED=false
```

The no-Redis quota fallback is process-local, intended for a single API instance, and resets when
that process restarts. Use managed Redis for multiple API instances. URL capture, OCR, Office, and
other native tools stay capability-disabled until a compatible worker service is connected.

## 3. Fully Native Node.js (VPS Production Server)

If you are deploying this to a raw Node.js server (like an EC2 instance or VPS) where your databases are hosted elsewhere, you do not need Docker at all.

```bash
# 1. Install dependencies and check the server prerequisites
corepack pnpm install
corepack pnpm node:doctor

# 2. Build shared packages, initialize the database, and seed the tool registry
corepack pnpm node:setup

# 3. Build the API, Worker, and Next.js Web app
corepack pnpm node:build

# 4. Start all three apps in production mode
corepack pnpm run node:start
```

_(Note: For a real production server, you might want to run the 3 apps using a process manager like PM2 instead of `pnpm run node:start` so they restart automatically if they crash)._

## 4. Fully Docker-based

To run the entire stack inside Docker (useful for quick testing on any machine).

```bash
# Build the current source, start everything, and wait for health checks
corepack pnpm run docker:up

# View logs
corepack pnpm run docker:logs
```

Open <http://localhost:5173>. Stop all containers with
`corepack pnpm docker:down`.

## Native environment defaults

The root `.env` is the canonical native configuration file:

```dotenv
DATABASE_URL=postgresql://docconv:docconv_secret@localhost:5432/docconv?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_PUBLIC_ENDPOINT=http://localhost:9000
GOTENBERG_URL=http://localhost:3100
```

Docker Compose overrides these values with internal service names. The application source is identical in both modes.

## Validation

```bash
corepack pnpm test
corepack pnpm node:build
corepack pnpm test:smoke
```
