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
- Redis 7+, MinIO/S3, Gotenberg 8, Pandoc, Poppler, Tesseract, LibreOffice, pdf2docx and fontconfig when server conversion workers are enabled
- ClamAV is mandatory in production; Docker mode provides it automatically

Worker dependencies on macOS:

```bash
brew install pandoc poppler tesseract fontconfig
brew install --cask libreoffice
python3 -m pip install pdf2docx==0.5.13
```

Worker dependencies on Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y pandoc poppler-utils tesseract-ocr libreoffice-core libreoffice-writer libreoffice-calc fontconfig fonts-dejavu-core fonts-liberation2 fonts-noto-core fonts-noto-cjk fonts-noto-color-emoji
python3 -m pip install pdf2docx==0.5.13
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

### Administrator access and subscription enforcement

Authenticated customers receive the limits of their active organization plan and any active SaaS
add-ons. Expired or inactive subscriptions do not grant access. Platform administrators bypass
subscription tier, monthly conversion, Blog Studio blog, and Blog Studio credit ceilings; usage is
still recorded for auditing and operational cost visibility. Per-tool technical file limits,
malware scanning, feature flags, tenant isolation, and unavailable-provider checks still apply to
administrators.

An administrator can be created idempotently during database seeding by setting both values in the
uncommitted `.env` file or the deployment secret manager:

```dotenv
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=use-a-unique-password-with-at-least-12-characters
```

No default administrator password is committed. Production seeding additionally requires the
explicit `ALLOW_ADMIN_SEED_IN_PRODUCTION=true` acknowledgement. Rotate or remove seed credentials
from the runtime environment after provisioning the account.

The same verified full-stack startup is also available as:

```bash
corepack pnpm start
```

Do not start `docconv-web` by itself with `docker start`. Server-backed PDF,
Office, OCR, and URL tools require the API, worker, PostgreSQL, Redis, MinIO,
and Gotenberg services. If the browser says the service is unavailable, repair
and verify the complete existing stack without rebuilding images:

```bash
corepack pnpm docker:repair
```

The web container is considered healthy only when both the website and API are
reachable. Long-running services use Docker's `always` restart policy so they
return after Docker Desktop or the host restarts.

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

## Existing databases created with `prisma db push`

Normal installations must use `corepack pnpm db:migrate`. If an older database was created with
`prisma db push` and has no Prisma migration history, first take and verify a complete database
backup, then run:

```bash
corepack pnpm db:adopt -- --confirm-backup
corepack pnpm db:migrate
```

`db:adopt` compares the live database to the current Prisma schema and aborts on any difference,
database error, or existing/partial migration history. It never repairs failed migrations. Use
`corepack pnpm db:adopt -- --dry-run` for a read-only check.

## Validation

```bash
corepack pnpm test
corepack pnpm node:build
corepack pnpm test:smoke
corepack pnpm test:migrations
```

## Persistent AI project memory

Authenticated users can create an organization-scoped project at `/app/assistant`, continue work
across multiple conversations, and inspect or edit durable project memory at `/app/memory`.
Memory is stored in PostgreSQL, maintained through the existing BullMQ/Redis infrastructure, and
retrieved with strict organization, project, user-visibility and lifecycle filters. The application
continues to support manual memory when no AI credential is configured; provider-backed chat,
automatic extraction, embeddings and generated summaries require server-only `AI_API_KEY`.

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_CHAT_MODEL=gpt-5-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
```

The ranking weights, context budgets, extraction threshold and retention periods are documented in
`.env.example`. Never expose the provider key through a `NEXT_PUBLIC_` variable.

Run the offline and live memory checks with:

```bash
corepack pnpm --filter @docconv/api test
corepack pnpm --filter @docconv/api test:memory:e2e
```

The live command expects the platform to be running (`corepack pnpm start`). It creates isolated
test organizations and verifies persistence, direct-ID authorization, project isolation,
deduplication, supersession, lifecycle exclusion, prompt-injection containment and provider-outage
durability.

## Blog Studio SaaS

Blog Studio is a native AppToolkitLab product. It shares the platform login, organizations,
PostgreSQL database, BullMQ/Redis processing, MinIO storage, billing controls, audit log and design
system; it does not run the source Blog Generator as a second website or MongoDB application.

- Public product page: <http://localhost:5173/saas/blog-studio>
- Workspace: <http://localhost:5173/app/blog-studio>
- Generator: <http://localhost:5173/app/blog-studio/new>
- History and usage: `/app/blog-studio/history` and `/app/blog-studio/usage`
- Shared pipeline: `packages/blog-engine`
- Hosted API: `apps/api/src/blog-studio`
- Standalone Windows source: `apps/blog-studio-desktop`

Hosted generation requires a server-side managed provider key:

```dotenv
FEATURE_BLOG_STUDIO=true
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_CHAT_MODEL=gpt-5-mini
BLOG_STUDIO_ENCRYPTION_KEY=replace-with-an-independent-32-byte-secret
TAVILY_API_KEY=
BLOG_IMAGE_MODEL=gpt-image-1
```

`TAVILY_API_KEY` is optional. When present (or when an organization owner adds a Tavily credential),
Blog Studio gathers validated public sources through the DNS-pinned research adapter. Without it,
the structured writing pipeline still runs but does not claim external web citations.

Checkout, image generation and desktop sales are deliberately fail-closed until their production
provider configuration and E2E gates pass:

```dotenv
FEATURE_BLOG_STUDIO_CHECKOUT=false
FEATURE_BLOG_STUDIO_IMAGES=false
FEATURE_BLOG_DESKTOP_SALES=false
STRIPE_BLOG_STUDIO_PRICE_ID=
RAZORPAY_BLOG_STUDIO_PLAN_ID=
LICENSE_SIGNING_PRIVATE_KEY=
```

Do not enable a commercial flag merely because its page compiles. Stripe/Razorpay webhook sandbox
tests, provider product IDs and secrets are required first. A Windows release additionally requires
an injected license verification public key, Authenticode signing and a clean-VM installer smoke
test. The desktop application uses a customer-supplied AI key encrypted by Electron `safeStorage`;
the hosted application never exposes customer-key configuration.

Blog Studio verification is included in the standard commands:

```bash
corepack pnpm test
corepack pnpm test:integration
corepack pnpm test:migrations
corepack pnpm build
```
