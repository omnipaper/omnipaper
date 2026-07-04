import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import {
  completeDocumentOcr,
  getDocumentById,
  markDocumentOcrFailed,
  markDocumentOcrProcessing,
} from "@omnipaper/database/queries/documents";
import { enqueue } from "@omnipaper/queue/producer";
import { defineTask } from "@omnipaper/queue/worker";
import { getStorageDriver } from "../lib/storage";
import { extractDocumentText } from "../lib/text-extract";

// Pull text out of types we can read natively (txt, docx) — no external OCR provider, no signed URL.
// Enqueued from ingestDocument() when the type isn't OCR-supported but is text-extractable. Reuses
// the document's ocr_* status columns: they track text availability regardless of how the text was
// obtained (OCR or native extraction).
export const textExtractTask = defineTask("text-extract", async ({ documentId }) => {
  const doc = await getDocumentById(db, { id: documentId });

  if (!doc) {
    return;
  }

  if (doc.ocrStatus === "completed") {
    return;
  }

  await markDocumentOcrProcessing(db, { id: documentId });

  try {
    const storage = await getStorageDriver();

    if (!storage) {
      throw new Error("Storage is not configured");
    }

    const original = await storage.getObject({ key: doc.storageKey });

    if (!original) {
      throw new Error("Original file not found in storage");
    }

    const text = await extractDocumentText(doc.mimeType, new Uint8Array(original.body));

    await completeDocumentOcr(db, {
      id: documentId,
      organizationId: doc.organizationId,
      title: doc.title,
      text,
    });

    try {
      await enqueue("workflow-dispatch", {
        documentId,
        trigger: "document.ocr_completed",
        triggerEventId: createId("wfe"),
      });
    } catch (dispatchErr) {
      console.error(
        `[text-extract] workflow dispatch failed for document ${documentId}:`,
        dispatchErr,
      );
    }
  } catch (err) {
    // Mirror ocr-extract: mark "failed" so the document leaves "processing" and the UI can offer a
    // re-run, and swallow rather than rethrow — a parse failure is deterministic (e.g. a corrupt
    // docx), so graphile-worker's default retries would just churn.
    await markDocumentOcrFailed(db, { id: documentId });
    console.error(`[text-extract] failed for document ${documentId}:`, err);
  }
});
