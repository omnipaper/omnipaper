<div align="center">

<img src="docs/branding/logos/26-archive-drawer-big-transparent.png" alt="omnipaper" width="120" />

# omnipaper

**A modern, opinionated document management system — a UX-first alternative to paperless-ngx, built for families and your own cloud storage.**

[Live demo](https://demo.omnipaper.app) · [Docs](https://docs.omnipaper.app) · [GitHub](https://github.com/omnipaper/omnipaper) · [License](#license)

_Pre-alpha, under active development — expect breaking changes between releases._

</div>

---

## What it is

omnipaper is a modern, opinionated document management system — a UX-first alternative to paperless-ngx, built for families and your own cloud storage. Upload a file, and it gets organized, searchable, and easy to find again.

Where paperless-ngx is capable but dense, omnipaper bets on a clean, responsive UI that works on a phone as well as a desktop — and a self-host story that is one Docker image plus a database.

## Screenshot

<!-- TODO: drop your app screenshot here — save it as docs/branding/screenshots/app.png (the directory exists; only .gitkeep is there now). Until then this image renders broken. -->
<a href="https://demo.omnipaper.app">
  <img src="docs/branding/screenshots/app.png" alt="omnipaper" width="100%" />
</a>

Try it live at **[demo.omnipaper.app](https://demo.omnipaper.app)**.

## Highlights

- **Cloud-storage-first** — your documents live in your own S3-compatible bucket (AWS S3, Cloudflare R2, MinIO), never on local disk. Backups and versioning stay your provider's job.
- **Opinionated, minimal setup** — strong defaults instead of endless knobs. Storage, OCR, and providers are configured in the UI, not in config files.
- **Built for families and teams** — multi-organization workspaces with roles and invitations, so everyone shares one archive.
- **Search everything** — optional OCR plus full-text search across your documents.
- **UX-first** — a clean, responsive interface designed for the browser and the phone from day one.
- **Dead-simple self-host** — a single Docker image plus PostgreSQL. No Redis, no extra services.

See the **[docs](https://docs.omnipaper.app)** for the full, current feature list.

## Self-hosting

omnipaper runs as a single Docker image alongside a PostgreSQL database and an S3-compatible bucket. A handful of environment variables get you booted; everything else is configured in the UI after you create the first account.

Full setup, environment reference, and a Docker Compose example are in the **[Installation docs](https://docs.omnipaper.app)**.

## Status

Pre-alpha, under active development — expect breaking changes between releases. The web app is the only client.

## Contributing

Issues, ideas, and pull requests are welcome — open one on [GitHub](https://github.com/omnipaper/omnipaper), or reach out at [hello@omnipaper.app](mailto:hello@omnipaper.app).

## License

omnipaper is **source-available / fair-code**, distributed under the **Sustainable Use License**.

- **Source available** — read, modify, and run the full source.
- **Free to self-host** — for yourself, your family, or internally within your company.
- **No competing service** — you can't offer omnipaper to others as a hosted commercial service.

An open-core / enterprise tier is planned. See [LICENSE](LICENSE) for the full terms, or reach out at [hello@omnipaper.app](mailto:hello@omnipaper.app) for a commercial license.

<details>
<summary><strong>Tech stack</strong> (for contributors)</summary>

<br />

A TypeScript monorepo (bun workspaces): a Hono API that also runs background jobs in-process (graphile-worker — no separate worker), a React web client, and a Fumadocs site. PostgreSQL for metadata, extracted text, and the job queue; S3-compatible object storage for files. Ships as a single Docker image with migrations applied on boot.

</details>
