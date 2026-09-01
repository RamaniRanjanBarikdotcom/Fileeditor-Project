# AppToolkitLab

AppToolkitLab is a Gonexel product built with Next.js, NestJS, and a separate Node.js conversion worker. It supports multiple runtime modes without changing application code:

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
# Stops Docker app containers if necessary, starts the four infrastructure
# containers, initializes the database, and runs all Node apps in parallel.
corepack pnpm run hybrid:dev
```

Open <http://localhost:5173>. Stop the foreground Node processes with `Ctrl+C`;
the infrastructure containers can be stopped with `corepack pnpm infra:down`.

## 2. Fully Native Node.js (Production Server)

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

*(Note: For a real production server, you might want to run the 3 apps using a process manager like PM2 instead of `pnpm run node:start` so they restart automatically if they crash).*

## 3. Fully Docker-based

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
