# AppToolkitLab startup commands

> Choose exactly one runtime mode. Do not run `node:dev` and `docker:up` at the same time because
> both try to use ports 5173 and 4201.

Project directory:

```bash
cd "/Users/ramani/Documents/file editor project/document-platform"
```

## Recommended local start

Docker supplies every required database, queue, storage and conversion service:

```bash
corepack pnpm docker:up
```

Open <http://localhost:5173>. You do not need to run `node:dev` after this command.

## Daily start without Docker

Use this when PostgreSQL, Redis, MinIO, Gotenberg and the native conversion programs
are installed and running on the server:

```bash
corepack pnpm node:dev
```

Open <http://localhost:5173>.

## First native Node.js setup

Run these commands once before the first native start:

```bash
corepack pnpm install
cp .env.example .env
corepack pnpm node:doctor
corepack pnpm node:setup
corepack pnpm node:dev
```

Review `.env` and replace the example secrets before using the application outside local
development.

## Managed Node server

This mode runs the web application and API without Redis or the native conversion worker. Browser
PDF tools work, but server conversions such as URL capture, OCR and PDF-to-Word require a separate
worker service.

```bash
corepack pnpm hostinger:build
corepack pnpm hostinger:start
```

## Hybrid start

This runs infrastructure in Docker and the API, worker and web application as Node.js processes:

```bash
corepack pnpm hybrid:dev
```

## Stop commands

- For a foreground Node.js process, press `Control+C` in its terminal.
- To stop AppToolkitLab Docker services, run:

```bash
corepack pnpm docker:down
```
