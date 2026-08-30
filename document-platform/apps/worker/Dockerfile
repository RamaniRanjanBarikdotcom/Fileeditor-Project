FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl pandoc poppler-utils tesseract-ocr \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages ./packages
RUN corepack pnpm install --frozen-lockfile

COPY apps/api/prisma ./apps/api/prisma
COPY apps/worker ./apps/worker
RUN corepack pnpm db:generate \
    && corepack pnpm --filter @docconv/worker... run build

CMD ["node", "apps/worker/dist/index.js"]
