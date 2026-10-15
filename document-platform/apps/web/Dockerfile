FROM node:22-bookworm-slim

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN --mount=type=cache,id=toolsuite-pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    corepack pnpm install --frozen-lockfile --filter web...

COPY apps/web ./apps/web
ARG INTERNAL_API_URL=http://api:4201
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
# Build every workspace package the web app depends on (in dependency order),
# then the app itself, so a new shared package needs no Dockerfile change.
RUN corepack pnpm --filter "web^..." run build \
    && corepack pnpm --filter web run build

EXPOSE 5173
CMD ["corepack", "pnpm", "--filter", "web", "exec", "next", "start", "--hostname", "0.0.0.0", "--port", "5173"]
