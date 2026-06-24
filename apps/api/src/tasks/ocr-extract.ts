import { db } from "@omnipaper/database/client";
import { createId } from "@omnipaper/database/id";
import {
  completeDocumentOcr,
  getDocumentById,
  markDocumentOcrFailed,
  markDocumentOcrProcessing,
} from "@omnipaper/database/queries/documents";
import { getOcrDefinition, OcrError } from "@omnipaper/ocr/resolve";
import { extractText } from "@omnipaper/ocr/runner";
import { enqueue } from "@omnipaper/queue/producer";
import { defineTask } from "@omnipaper/queue/worker";
import { getOcrSettings } from "@omnipaper/settings/ocr-settings";
import { getProviderKeys } from "@omnipaper/settings/provider-settings";
import { getStorageDriver } from "../lib/storage";

export const ocrExtractTask = defineTask("ocr-extract", async ({ documentId }, helpers) => {
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

    // Compose the OCR selection and the shared provider keys at the call site;
    // the chosen definition's provider tells us which key the runner needs.
    const ocr = await getOcrSettings();
    const keys = await getProviderKeys();
    const { provider } = getOcrDefinition(ocr.definitionId);

    if (!keys[provider]) {
      throw new Error(`OCR is not configured: missing ${provider} API key`);
    }

    const { url } = await storage.createDownloadUrl({ key: doc.storageKey });

    const { text } = await extractText({
      definitionId: ocr.definitionId,
      model: ocr.model,
      documentUrl: url,
      mimeType: doc.mimeType,
      keys,
    });

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
        `[ocr-extract] workflow dispatch failed for document ${documentId}:`,
        dispatchErr,
      );
    }
  } catch (err) {
    // Transient provider errors (429 rate limit, 5xx, network) are retryable: rethrow so
    // graphile-worker retries with exponential backoff. The job stays in the queue and the document
    // stays "processing" between attempts. OCR jobs are capped low and serialized (see producer.ts).
    if (
      err instanceof OcrError &&
      err.retryable &&
      helpers.job.attempts < helpers.job.max_attempts
    ) {
      throw err;
    }

    // Terminal error (missing key, unsupported mime) or retries exhausted: mark "failed" so the
    // document leaves "processing" and the UI can offer an explicit re-run. We swallow so
    // graphile-worker doesn't keep retrying. The runner already redacts secrets from its errors.
    await markDocumentOcrFailed(db, { id: documentId });
    console.error(`[ocr-extract] failed for document ${documentId}:`, err);
  }
});
