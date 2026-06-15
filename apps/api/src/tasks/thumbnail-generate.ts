import { PDFiumLibrary } from "@hyzyla/pdfium";
import { db } from "@omnipaper/database/client";
import {
  getDocumentById,
  markDocumentThumbnailCompleted,
  markDocumentThumbnailFailed,
  markDocumentThumbnailProcessing,
} from "@omnipaper/database/queries/documents";
import { defineTask } from "@omnipaper/queue/worker";
import { getStorageSettings } from "@omnipaper/settings/storage-settings";
import { createS3Driver } from "@omnipaper/storage/s3";
import { PNG } from "pngjs";

const THUMBNAIL_WIDTH = 500;

// Render the first page of a PDF to a small PNG and store it next to the original under
// `<storageKey>.thumb.png` (the key the /thumb endpoint reads). Enqueued from ingestDocument() for
// PDFs only; other types are marked "unsupported" there and never reach this task. The whole
// pipeline is pure WASM/JS (pdfium + pngjs) — no native binaries, so it runs the same on bun, Node,
// and in the Docker image.
export const thumbnailGenerateTask = defineTask("thumbnail-generate", async ({ documentId }) => {
  const doc = await getDocumentById(db, { id: documentId });

  if (!doc) {
    return;
  }

  if (doc.thumbnailStatus === "completed") {
    return;
  }

  await markDocumentThumbnailProcessing(db, { id: documentId });

  try {
    const storageSettings = await getStorageSettings();

    if (!storageSettings) {
      throw new Error("Storage is not configured");
    }

    const storage = createS3Driver(storageSettings);

    const original = await storage.getObject({ key: doc.storageKey });

    if (!original) {
      throw new Error("Original file not found in storage");
    }

    const png = await renderFirstPagePng(new Uint8Array(original.body));

    await storage.putObject({
      key: `${doc.storageKey}.thumb.png`,
      body: png,
      contentType: "image/png",
    });

    await markDocumentThumbnailCompleted(db, { id: documentId });
  } catch (err) {
    // Mark "failed" so the document leaves "processing" and the card falls back to the generic
    // icon. Swallow rather than rethrow: a render failure is deterministic (e.g. a corrupt PDF), so
    // graphile-worker's default 25 retries would just churn. Re-run is a future explicit action.
    await markDocumentThumbnailFailed(db, { id: documentId });
    console.error(`[thumbnail-generate] failed for document ${documentId}:`, err);
  }
});

async function renderFirstPagePng(pdfBytes: Uint8Array): Promise<Uint8Array> {
  // The node build embeds the WASM as base64, so init() needs no path/network. Init per job keeps
  // each render isolated (own WASM heap); a shared singleton is a later optimization if needed.
  const library = await PDFiumLibrary.init();

  try {
    const document = await library.loadDocument(pdfBytes);

    try {
      // Render the first page straight at the target pixel width (pdfium scales it), so there's no
      // separate resize step — which is why we don't need sharp/libvips at all.
      const bitmap = await document.getPage(0).render({ width: THUMBNAIL_WIDTH, render: "bitmap" });

      // pdfium's "bitmap" engine already returns RGBA (verified: a pure-red page renders to bytes
      // [255,0,0,255]), so the buffer feeds straight into pngjs — no channel swap needed.
      const png = new PNG({ width: bitmap.width, height: bitmap.height });
      png.data = Buffer.from(bitmap.data);
      return new Uint8Array(PNG.sync.write(png));
    } finally {
      document.destroy();
    }
  } finally {
    library.destroy();
  }
}
