<table>
  <tr>
    <td width="250" align="center" valign="top">
      <img src="apps/web/public/apple-touch-icon.png" alt="omnipaper" width="220">
    </td>
    <td valign="top">
      <h1>omnipaper</h1>
      <p><strong>A modern document manager that's actually pleasant to self-host.</strong></p>
      <p>
        <a href="https://omnipaper.app">omnipaper.app</a> ·
        <a href="https://demo.omnipaper.app">demo</a> ·
        <a href="https://docs.omnipaper.app">docs</a> ·
        <a href="https://github.com/omnipaper/omnipaper">github</a>
      </p>
      <p><sub>Pre-alpha — under active development. Breaking changes between releases.</sub></p>
    </td>
  </tr>
</table>

---

## What it is

omnipaper is a modern, opinionated document management system. It's a UX-first alternative to paperless-ngx, built for families and your own cloud storage. Upload a file, and it gets organized, searchable, and easy to find again.

Where paperless-ngx is capable but dense, omnipaper bets on a clean, responsive UI that works on a phone as well as a desktop

## Screenshot

<a href="https://demo.omnipaper.app">
  <img src="apps/web/public/demo.png" alt="omnipaper" width="100%" />
</a>

Try it live at **[demo.omnipaper.app](https://demo.omnipaper.app)**.

## Highlights

- **Cloud-storage first** — your documents live in your own S3-compatible bucket (AWS S3, Cloudflare R2, MinIO), never on local disk. Backups and versioning stay your provider's job.
- **Minimal setup** — strong defaults instead of endless knobs. Storage, OCR, and providers are configured in the UI, not in config files.
- **Built for families and teams** — multi-organization workspaces with roles and invitations, so everyone shares one archive.
- **Search everything** — optional OCR plus full-text search across your documents.
- **UX-first** — a clean, responsive interface designed for the browser and the phone from day one.
- **Dead-simple self-host** — a single Docker image plus PostgreSQL. No Redis, no extra services.

See the **[docs](https://docs.omnipaper.app)** for the full, current feature list.

## Self-hosting

omnipaper runs as a single Docker image alongside a PostgreSQL database and an S3-compatible bucket. A handful of environment variables get you booted; everything else is configured in the UI after you create the first account.

Full setup, environment reference, and a Docker Compose example are in the **[Installation docs](https://docs.omnipaper.app)**.

## Status

Pre-alpha, under active development. Expect breaking changes between releases. The web app is the only client.

## Contributing

Issues, ideas, and pull requests are welcome Open one on [GitHub](https://github.com/omnipaper/omnipaper)

## License

omnipaper is **open source** and distributed under the **Sustainable Use License**.

- **Open source** — read, modify, and run the full source.
- **Free to self-host** — for yourself, your family, or internally within your company.