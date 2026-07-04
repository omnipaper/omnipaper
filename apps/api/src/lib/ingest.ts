import { createHash } from "node:crypto";
import type { Database } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import {
  createDocument,
  getDocumentByHash,
  markDocumentOcrUnsupported,
  markDocumentThumbnailCompleted,
  markDocumentThumbnailUnsupported,
} from "@omnipaper/database/queries/documents";
import { supportsMime } from "@omnipaper/ocr/resolve";
import { enqueue } from "@omnipaper/queue/producer";
import { getOcrSettings } from "@omnipaper/settings/ocr-settings";
import { normalizeMimeType } from "@omnipaper/shared/formats";
import type { StorageDriver } from "@omnipaper/storage/driver";
import { isTextExtractable } from "./text-extract";

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
  title?: string;
  documentDate?: string;
  createdAt?: Date;
};

export async function ingestDocument(input: IngestDocumentInput): Promise<IngestResult> {
  const { db, driver, organizationId, createdBy, bytes, filename } = input;
  // Canonicalise the MIME up front: every downstream decision (storage content-type, lane triage,
  // OCR support) keys off the bare type, never the browser's ";charset=…"-tagged variant.
  const mimeType = normalizeMimeType(input.mimeType);

  const sha256 = createHash("sha256").update(bytes).digest("hex");

  // Already in this org? Return it and never write the duplicate's bytes to storage.
  const existing = await getDocumentByHash(db, { organizationId, sha256 });
  if (existing) {
    return { status: "duplicate", document: { id: existing.id, title: existing.title } };
  }

  const id = createId("doc");
  const storageKey = `${organizationId}/${id}`;
  const title = input.title?.trim() || stripExtension(filename);

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

  await enqueue("workflow-dispatch", {
    documentId: id,
    trigger: "document.created",
    triggerEventId: createId("wfe"),
  });

  const { definitionId } = await getOcrSettings();

  // Pick the lane that yields the document's text: OCR (PDF + images, external provider), native
  // extraction (txt, docx — no provider), or none. Genuinely text-less unsupported types fall through.
  const lane = supportsMime(definitionId, mimeType)
    ? "ocr"
    : isTextExtractable(mimeType)
      ? "text"
      : "unsupported";

  if (lane === "unsupported") {
    await markDocumentOcrUnsupported(db, { id });
  } else {
    await enqueue(lane === "ocr" ? "ocr-extract" : "text-extract", { documentId: id });
  }

  // Thumbnails: PDFs get a first-page render in the background; images are their own preview (the
  // /thumb endpoint serves the original bytes for them — no render needed), so mark them complete up
  // front; everything else shows a generic icon, so mark it unsupported. Independent of OCR above.
  if (mimeType === "application/pdf") {
    await enqueue("thumbnail-generate", { documentId: id });
  } else if (mimeType.startsWith("image/")) {
    await markDocumentThumbnailCompleted(db, { id });
  } else {
    await markDocumentThumbnailUnsupported(db, { id });
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
