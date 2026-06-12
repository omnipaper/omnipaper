import { createHash } from "node:crypto";
import type { Database } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import {
  completeDocumentOcr,
  createDocument,
  getDocumentByHash,
  markDocumentOcrUnsupported,
} from "@omnipaper/database/queries/documents";
import { supportsMime } from "@omnipaper/ocr/resolve";
import { enqueue } from "@omnipaper/queue/producer";
import { getOcrSettings } from "@omnipaper/settings/ocr-settings";
import type { StorageDriver } from "@omnipaper/storage/driver";

// The single ingest funnel: hash → dedupe (per org) → store → enqueue OCR, in one place. Browser
// uploads call it today; future sources (email, public API) call it the same way with bytes in hand.

export type IngestResult = {
  status: "created" | "duplicate";
  document: { id: string; title: string };
};

export type IngestDocumentInput = {
  db: Database;
  driver: StorageDriver;
  organizationId: string;
  createdBy: string;
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  // Optional overrides for non-upload sources (e.g. migration). A browser upload omits all of these.
  title?: string;
  // Pre-extracted text to carry over instead of re-running OCR. Used only for a MIME the active
  // engine can read; blank/whitespace is treated as absent (falls back to queuing OCR).
  ocrText?: string;
  // The document's own date (e.g. Paperless `created`, already resolved to a calendar date).
  documentDate?: string;
  // Override the system ingestion timestamp (e.g. Paperless `added`). Defaults to now.
  createdAt?: Date;
};

export async function ingestDocument(input: IngestDocumentInput): Promise<IngestResult> {
  const { db, driver, organizationId, createdBy, bytes, filename, mimeType } = input;

  const sha256 = createHash("sha256").update(bytes).digest("hex");

  // Already in this org? Return it and never write the duplicate's bytes to storage.
  const existing = await getDocumentByHash(db, { organizationId, sha256 });
  if (existing) {
    return { status: "duplicate", document: { id: existing.id, title: existing.title } };
  }

  const id = createId("doc");
  const storageKey = `${organizationId}/${id}`;
  // Non-upload sources pass an explicit title; a browser upload derives it from the filename.
  const title = input.title?.trim() || stripExtension(filename);

  // Object first, then row. If the insert loses a race on the (org, sha256) unique index, we delete
  // the object we just wrote so a rejected duplicate leaves no orphan.
  await driver.putObject({ key: storageKey, body: bytes, contentType: mimeType });

  try {
    await createDocument(db, {
      id,
      organizationId,
      createdBy,
      title,
      originalFilename: filename,
      storageKey,
      mimeType,
      sizeBytes: bytes.byteLength,
      sha256,
      documentDate: input.documentDate,
      createdAt: input.createdAt,
    });
  } catch (err) {
    await driver.deleteObject({ key: storageKey });

    if (isUniqueViolation(err)) {
      const raced = await getDocumentByHash(db, { organizationId, sha256 });
      if (raced) {
        return { status: "duplicate", document: { id: raced.id, title: raced.title } };
      }
    }

    throw err;
  }

  // The funnel decides OCR, not the caller — so every source gets the same treatment:
  //  - readable MIME with carried-over text (e.g. migration) → store it, mark completed, no re-OCR
  //  - readable MIME without text → queue extraction
  //  - unreadable MIME → "unsupported" so it settles instead of failing every attempt
  // Blank carry-over text counts as absent, so a source with empty text still gets OCR'd.
  const { definitionId } = await getOcrSettings();
  const carriedText = input.ocrText?.trim() ? input.ocrText : undefined;

  if (supportsMime(definitionId, mimeType)) {
    if (carriedText) {
      await completeDocumentOcr(db, { id, organizationId, title, text: carriedText });
    } else {
      await enqueue("ocr-extract", { documentId: id });
    }
  } else {
    await markDocumentOcrUnsupported(db, { id });
  }

  return { status: "created", document: { id, title } };
}

// Postgres unique-violation SQLSTATE — distinguishes a dedup race from any other insert failure.
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

// Title drops the extension (mimeType already carries it); the stored filename keeps it.
function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 && dot < filename.length - 1 ? filename.slice(0, dot) : filename;
}
