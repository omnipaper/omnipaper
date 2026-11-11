<div align="center">
  <img src="apps/web/public/apple-touch-icon.png" alt="omnipaper logo" width="96">
  <h1>omnipaper</h1>
  <p><strong>A modern document manager that's actually pleasant to self-host.</strong></p>
  <p>
    <a href="https://omnipaper.app">Website</a> ·
    <a href="https://demo.omnipaper.app">Live demo</a> ·
    <a href="https://docs.omnipaper.app">Docs</a> ·
    <a href="https://docs.omnipaper.app/installation">Install</a>
  </p>
  <p><sub>Pre-alpha. Under active development, expect breaking changes between releases.</sub></p>
</div>

<br>

<a href="https://demo.omnipaper.app">
  <img src=".github/assets/documents.png" alt="omnipaper document gallery with tagged bills, invoices, receipts and contracts" width="100%">
</a>

## What it is

omnipaper is a self-hosted home for your paperwork: bills, invoices, receipts, contracts,
payslips, school reports. Upload a file and it becomes organized, searchable and easy to
find again, from your laptop or your phone.

It's a UX-first alternative to paperless-ngx, built for families and small teams, and it
keeps your files in your own S3-compatible bucket.

Try it without installing anything at **[demo.omnipaper.app](https://demo.omnipaper.app)**.

## Highlights

- **Your bucket, your files.** Documents live in S3-compatible storage you own (AWS S3,
  Cloudflare R2, MinIO), never on the app server's disk. Backups and versioning stay your
  provider's job.
- **Dead-simple self-hosting.** One Docker image plus PostgreSQL. No Redis, no separate
  worker, nothing else to wire up.
- **Configured in the UI.** A handful of env vars to boot. Storage, OCR and AI providers are
  set up in the app after your first login.
- **Organize your way.** Document types, tags, folder-like storage paths, custom properties
  and saved views.
- **Search everything.** Full-text search across titles and document contents, with optional
  OCR for scans and photos.
- **Hands-off intake.** Pull attachments from an IMAP mailbox, run workflows on new
  documents, and let an LLM suggest or fill in titles, dates, types and tags.
- **Built for families and teams.** Shared workspaces with roles and invitations.
- **Works on your phone.** A clean, responsive UI designed for mobile from day one.

## A closer look

<table>
  <tr>
    <td width="50%" valign="top">
      <img src=".github/assets/document-detail.png" alt="Document detail with metadata form and PDF preview">
      <p align="center"><sub><b>Document detail.</b> Edit metadata next to the preview, with OCR text and an activity history one tab away.</sub></p>
    </td>
    <td width="50%" valign="top">
      <img src=".github/assets/saved-views.png" alt="List view filtered by a saved view for bills and invoices">
      <p align="center"><sub><b>Saved views.</b> Save any combination of search, filters and layout and pin it to the sidebar.</sub></p>
    </td>
  </tr>
</table>

<img src=".github/assets/mobile.png" alt="omnipaper on a phone: document gallery, document detail and navigation" width="100%">
<p align="center"><sub><b>On your phone.</b> The same app, laid out for a small screen.</sub></p>

## Self-hosting

omnipaper runs as a single Docker image next to a PostgreSQL database:

```yaml
services:
  postgres:
    image: postgres:18
    restart: unless-stopped
    environment:
      POSTGRES_USER: omnipaper
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: omnipaper
    volumes:
      - postgres-data:/var/lib/postgresql/data

  app:
    image: ghcr.io/omnipaper/omnipaper:0
    restart: unless-stopped
    depends_on:
      - postgres
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://omnipaper:change-me@postgres:5432/omnipaper
      AUTH_SECRET: # openssl rand -base64 32
      ENCRYPTION_KEY: # openssl rand -base64 32

volumes:
  postgres-data:
```

Run `docker compose up -d`, open `http://localhost:3000` and create the first account. Then
connect your bucket in the app's settings.

The **[installation docs](https://docs.omnipaper.app/installation)** cover image tags, the
full environment reference, custom domains, [storage](https://docs.omnipaper.app/storage),
[OCR](https://docs.omnipaper.app/ocr) and [AI](https://docs.omnipaper.app/ai) setup.

## Status

Pre-alpha and under active development. Expect breaking changes between releases, and pin
a specific `0.x.y` image tag. The web app is the only client for now.

## Contributing

Issues, ideas and pull requests are welcome. Open one on
[GitHub](https://github.com/omnipaper/omnipaper/issues).

## License

omnipaper is **source-available** under the **[Sustainable Use License](LICENSE)**, a
fair-code license.

- **Read, modify and run** the full source.
- **Self-host for free** for yourself, your family, or internally within your company.
- **Commercial use** such as offering omnipaper as a hosted service or reselling it needs a
  commercial license. Contact [hello@omnipaper.app](mailto:hello@omnipaper.app).
