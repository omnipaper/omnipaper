# syntax=docker/dockerfile:1

FROM oven/bun:1.2.23-alpine AS base
WORKDIR /app

# ---- build: all deps + build the SPA ----
FROM base AS build
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/docs/package.json apps/docs/
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
COPY packages/env/package.json packages/env/
COPY packages/ocr/package.json packages/ocr/
COPY packages/permissions/package.json packages/permissions/
COPY packages/queue/package.json packages/queue/
COPY packages/settings/package.json packages/settings/
COPY packages/storage/package.json packages/storage/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run --cwd apps/web build

# ---- prod-deps: runtime dependencies only (no vite/biome/tsc/drizzle-kit) ----
FROM base AS prod-deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
# apps/docs ships only devDependencies, so --production installs nothing from it
COPY apps/docs/package.json apps/docs/
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
COPY packages/env/package.json packages/env/
COPY packages/ocr/package.json packages/ocr/
COPY packages/permissions/package.json packages/permissions/
COPY packages/queue/package.json packages/queue/
COPY packages/settings/package.json packages/settings/
COPY packages/storage/package.json packages/storage/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile --production

# ---- runtime: slim final image ----
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
