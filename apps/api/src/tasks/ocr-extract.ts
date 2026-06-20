import { db } from "@omnipaper/database/client";
import {
  completeDocumentOcr,
  getDocumentById,
  markDocumentOcrFailed,
  markDocumentOcrProcessing,
} from "@omnipaper/database/queries/documents";
import { getOcrDefinition } from "@omnipaper/ocr/resolve";
import { extractText } from "@omnipaper/ocr/runner";
import { defineTask } from "@omnipaper/queue/worker";
import { getOcrSettings } from "@omnipaper/settings/ocr-settings";
import { getProviderKeys } from "@omnipaper/settings/provider-settings";
import { getStorageDriver } from "../lib/storage";

export const ocrExtractTask = defineTask("ocr-extract", async ({ documentId }) => {
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
  } catch (err) {
    // Mark the document "failed" so it leaves "processing" and the UI can offer a re-run. We
    // swallow rather than rethrow: graphile-worker would otherwise retry up to its default 25 times
    // (pointless for a config error like a missing key) and flip the status back and forth.
    // Recovery is an explicit user action — the Re-run OCR button. The runner already redacts
    // secrets from its errors.
    await markDocumentOcrFailed(db, { id: documentId });
    console.error(`[ocr-extract] failed for document ${documentId}:`, err);
  }
});
