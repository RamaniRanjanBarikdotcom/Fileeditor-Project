FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
RUN --mount=type=cache,id=toolsuite-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    corepack pnpm install --frozen-lockfile --filter @docconv/api...

COPY apps/api ./apps/api
RUN corepack pnpm db:generate \
    && corepack pnpm --filter @docconv/api... run build

EXPOSE 4201
CMD ["node", "apps/api/dist/main.js"]
