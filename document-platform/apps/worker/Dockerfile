FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl pandoc poppler-utils tesseract-ocr python3 python3-venv \
    && python3 -m venv /opt/pdf2docx \
    && /opt/pdf2docx/bin/pip install --no-cache-dir pdf2docx==0.5.13 \
    && ln -s /opt/pdf2docx/bin/pdf2docx /usr/local/bin/pdf2docx \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages ./packages
RUN --mount=type=cache,id=toolsuite-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    corepack pnpm install --frozen-lockfile --filter @docconv/worker... --filter @docconv/api

COPY apps/api/prisma ./apps/api/prisma
COPY apps/worker ./apps/worker
RUN corepack pnpm db:generate \
    && corepack pnpm --filter @docconv/worker... run build

CMD ["node", "apps/worker/dist/index.js"]
