# omnipaper

Modern, open-source document management with native S3-compatible cloud storage support.

A cloud-first alternative to paperless-ngx, designed with mobile in mind from day one.

## Status

Pre-alpha — under active development.

## Stack

| Layer       | Choice                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| Backend     | [Hono](https://hono.dev/) on [Bun](https://bun.sh/) (REST API)               |
| Database    | [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/) |
| Queue       | [graphile-worker](https://worker.graphile.org/) (Postgres-backed)            |
| Auth        | [better-auth](https://www.better-auth.com/)                                  |
| Web         | [Vite](https://vitejs.dev/) + React + [TanStack Router/Query](https://tanstack.com/) |
| Mobile      | [Expo](https://expo.dev/) (React Native)                                     |
| Storage     | S3-compatible (AWS S3, Cloudflare R2)                                        |
| OCR         | External LLM APIs (Mistral OCR, OpenAI, Anthropic)                           |
| Monorepo    | [Bun workspaces](https://bun.sh/docs/install/workspaces)                     |
| Lint/Format | [Biome](https://biomejs.dev/)                                                |

## Structure

```
apps/
  api/         Hono REST API
  worker/      graphile-worker (jobs + cron)
  web/         Vite + React SPA
  mobile/      Expo RN app
packages/
  database/    Drizzle schema + migrations
  types/       Shared TypeScript types
  api-client/  OpenAPI-generated TS client
  storage/     S3/R2 adapter
  queue/       graphile-worker setup + job schemas
  ocr/         OCR provider adapters
```

## Development

Requires [Bun](https://bun.sh/) >= 1.2.0 and PostgreSQL 16+.

```bash
bun install
bun run dev
```

## License

[GNU Affero General Public License v3.0 or later](LICENSE)
