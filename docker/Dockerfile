# syntax=docker/dockerfile:1

FROM oven/bun:1.4.2-alpine AS base
WORKDIR /app

# ---- build: all deps + build the SPA ----
FROM base AS build
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/ai/package.json packages/ai/
COPY packages/database/package.json packages/database/
COPY packages/env/package.json packages/env/
COPY packages/logger/package.json packages/logger/
COPY packages/ocr/package.json packages/ocr/
COPY packages/permissions/package.json packages/permissions/
COPY packages/queue/package.json packages/queue/
COPY packages/settings/package.json packages/settings/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/tracing/package.json packages/tracing/
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
COPY packages/logger/package.json packages/logger/
COPY packages/ocr/package.json packages/ocr/
COPY packages/permissions/package.json packages/permissions/
COPY packages/queue/package.json packages/queue/
COPY packages/settings/package.json packages/settings/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
COPY packages/tracing/package.json packages/tracing/
COPY packages/ui/package.json packages/ui/

# Langfuse tracing is opt-in at build time: the OpenTelemetry closure adds ~42MB to a
# ~400MB image and most self-hosters never look at a trace, so it is only installed
# when asked for. Without it the API still runs; instrumentation.ts degrades to a warning.
ARG WITH_TRACING=false

# only the API workspace's prod dependency closure — not web/docs/ui or any devDeps
RUN if [ "$WITH_TRACING" = "true" ]; then \
      bun install --frozen-lockfile --production --filter='@omnipaper/api' --filter='@omnipaper/tracing'; \
    else \
      bun install --frozen-lockfile --production --filter='@omnipaper/api'; \
    fi

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
