FROM node:22-bookworm-slim

WORKDIR /app

# Puppeteer is present through the API workspace used for Prisma generation,
# but browser rendering in this image is handled by Gotenberg. Do not download
# an unused browser while installing the worker dependency graph.
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      openssl pandoc poppler-utils python3 python3-venv \
      tesseract-ocr tesseract-ocr-hin tesseract-ocr-deu tesseract-ocr-fra tesseract-ocr-spa \
      tesseract-ocr-ita tesseract-ocr-por tesseract-ocr-ara tesseract-ocr-chi-sim \
      libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw \
      fontconfig fonts-dejavu-core fonts-liberation2 fonts-noto-core fonts-noto-cjk fonts-noto-color-emoji \
    && fc-cache -f \
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
