# Docs: static Next.js export (fumadocs) served by nginx.
# Build: docker build -t docs apps/docs
# The image needs no environment variables.

# ---- build: bun install + next build (output: "export" -> out/) ----
FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# ---- runtime: unprivileged nginx, listens on 8080 ----
FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 8080
