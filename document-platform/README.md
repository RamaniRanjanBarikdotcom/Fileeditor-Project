# ToolSuite

ToolSuite is a Next.js + NestJS document platform with a separate Node.js conversion worker. It supports two runtime modes without changing application code:

- **Docker mode:** every service runs in Docker Compose.
- **Node/hybrid mode:** Next.js, NestJS, and the worker run directly in Node.js; only infrastructure runs in Docker.
- **Fully native mode:** all Node processes and infrastructure services are installed directly on the server.

## Requirements

- Node.js 20 or newer
- Corepack (included with Node.js)
- PostgreSQL 16+, Redis 7+, MinIO/S3, and Gotenberg 8
- Pandoc, Poppler (`pdftoppm`), and Tesseract on the worker host

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
# This will start infra, setup the database, and run the node apps in parallel
corepack pnpm run hybrid:dev
```

## 2. Fully Native Node.js (Production Server)

If you are deploying this to a raw Node.js server (like an EC2 instance or VPS) where your databases are hosted elsewhere, you do not need Docker at all.

```bash
# 1. Install dependencies
corepack pnpm install

# 2. Setup the database schema (make sure DATABASE_URL in .env points to your DB)
corepack pnpm run db:push

# 3. Build the API, Worker, and Next.js Web app
corepack pnpm run build

# 4. Start all three apps in production mode
corepack pnpm run node:start
```

*(Note: For a real production server, you might want to run the 3 apps using a process manager like PM2 instead of `pnpm run node:start` so they restart automatically if they crash).*

## 3. Fully Docker-based

To run the entire stack inside Docker (useful for quick testing on any machine).

```bash
# Start everything in the background
corepack pnpm run docker:up

# View logs
corepack pnpm run docker:logs
```

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
corepack pnpm test:integration
```
