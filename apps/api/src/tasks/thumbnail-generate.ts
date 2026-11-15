import { db } from "@omnipaper/database/client";
import {
  getDocumentById,
  markDocumentThumbnailCompleted,
  markDocumentThumbnailFailed,
  markDocumentThumbnailProcessing,
} from "@omnipaper/database/queries/documents";
import { defineTask } from "@omnipaper/queue/worker";
import { PNG } from "pngjs";
import { getPdfiumLibrary } from "../lib/pdfium";
import { getStorageDriver } from "../lib/storage";
import { taskLogger } from "../logger";

const THUMBNAIL_WIDTH = 500;

// Writes `<storageKey>.thumb.png`, the key /thumb reads. Only PDFs are enqueued (ingestDocument marks
// the rest "unsupported"). Pure WASM/JS on purpose: native image libs fail under bun.
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
    const storage = await getStorageDriver();

    if (!storage) {
      throw new Error("Storage is not configured");
    }

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
    // Swallow and mark failed: render failures are deterministic (e.g. a corrupt PDF), so retries
    // would only churn. The card falls back to the generic icon.
    await markDocumentThumbnailFailed(db, { id: documentId });
    taskLogger.error({ err, documentId }, "thumbnail render failed");
  }
});

async function renderFirstPagePng(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const library = await getPdfiumLibrary();
  const document = await library.loadDocument(pdfBytes);

  try {
    // Render the first page straight at the target pixel width (pdfium scales it), so there's no
    // separate resize step — which is why we don't need sharp/libvips at all.
    const bitmap = await document.getPage(0).render({ width: THUMBNAIL_WIDTH, render: "bitmap" });

    // pdfium's bitmap is already RGBA, so it feeds pngjs without a channel swap.
    const png = new PNG({ width: bitmap.width, height: bitmap.height });
    png.data = Buffer.from(bitmap.data);
    return new Uint8Array(PNG.sync.write(png));
  } finally {
    document.destroy();
  }
}
