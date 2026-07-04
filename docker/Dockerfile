# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app

# ---- build: all deps + build the SPA ----
FROM base AS build
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/ai/package.json packages/ai/
COPY packages/database/package.json packages/database/
COPY packages/env/package.json packages/env/
COPY packages/ocr/package.json packages/ocr/
COPY packages/permissions/package.json packages/permissions/
COPY packages/queue/package.json packages/queue/
COPY packages/settings/package.json packages/settings/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile
COPY . .

# demo build argument. For build time
ARG DEMO_MODE
ENV VITE_DEMO_MODE=$DEMO_MODE
RUN bun run --cwd apps/web build

# ---- prod-deps: runtime dependencies only (no vite/biome/tsc/drizzle-kit) ----
FROM base AS prod-deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/ai/package.json packages/ai/
COPY packages/database/package.json packages/database/
COPY packages/env/package.json packages/env/
COPY packages/ocr/package.json packages/ocr/
COPY packages/permissions/package.json packages/permissions/
COPY packages/queue/package.json packages/queue/
COPY packages/settings/package.json packages/settings/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/ui/package.json packages/ui/

# only the API workspace's prod dependency closure — not web/docs/ui or any devDeps
RUN bun install --frozen-lockfile --production --filter='@omnipaper/api'

# ---- runtime: final image ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY apps/api ./apps/api
COPY packages ./packages
COPY package.json ./
USER bun
EXPOSE 3000
CMD ["bun", "run", "apps/api/src/index.ts"]
