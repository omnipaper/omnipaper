import { PDFiumLibrary } from "@hyzyla/pdfium";
import { db } from "@omnipaper/database/client";
import {
  getDocumentById,
  markDocumentThumbnailCompleted,
  markDocumentThumbnailFailed,
  markDocumentThumbnailProcessing,
} from "@omnipaper/database/queries/documents";
import { defineTask } from "@omnipaper/queue/worker";
import { PNG } from "pngjs";
import { getStorageDriver } from "../lib/storage";

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
    // Mark "failed" so the document leaves "processing" and the card falls back to the generic
    // icon. Swallow rather than rethrow: a render failure is deterministic (e.g. a corrupt PDF), so
    // graphile-worker's default 25 retries would just churn. Re-run is a future explicit action.
    await markDocumentThumbnailFailed(db, { id: documentId });
    console.error(`[thumbnail-generate] failed for document ${documentId}:`, err);
  }
});

// PDFium's WASM heap is allocated once and reused for every job. The old code ran PDFiumLibrary.init()
// per render, and each init builds a fresh Emscripten module with its own ~18MB WebAssembly.Memory.
// library.destroy() only runs pdfium's C-level teardown (_FPDF_DestroyLibrary) — it cannot release
// that WASM heap, and WASM memory never shrinks, so every processed PDF abandoned a heap the GC
// reclaimed slowly and RSS climbed monotonically until restart. One shared library fixes it: pdfium
// is designed to init once and load many documents, and graphile-worker concurrency is async on a
// single JS thread (renders never truly overlap), so concurrent jobs just load and destroy their own
// document handles against the one bounded heap.
let pdfiumLibraryPromise: Promise<PDFiumLibrary> | null = null;

function getPdfiumLibrary(): Promise<PDFiumLibrary> {
  pdfiumLibraryPromise ??= PDFiumLibrary.init();
  return pdfiumLibraryPromise;
}

async function renderFirstPagePng(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const library = await getPdfiumLibrary();
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
    // Frees this document's memory inside the shared heap; the heap itself stays put for reuse.
    document.destroy();
  }
}
