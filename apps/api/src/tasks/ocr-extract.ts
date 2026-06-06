import { db } from "@omnipaper/database/client";
import {
  completeDocumentOcr,
  getDocumentById,
  markDocumentOcrProcessing,
} from "@omnipaper/database/queries/documents";
import { getOcrDefinition } from "@omnipaper/ocr/resolve";
import { extractText } from "@omnipaper/ocr/runner";
import { defineTask } from "@omnipaper/queue/worker";
import { getOcrSettings } from "@omnipaper/settings/ocr-settings";
import { getProviderKeys } from "@omnipaper/settings/provider-settings";
import { getStorageSettings } from "@omnipaper/settings/storage-settings";
import { createS3Driver } from "@omnipaper/storage/s3";

export const ocrExtractTask = defineTask("ocr-extract", async ({ documentId }) => {
  const doc = await getDocumentById(db, { id: documentId });

  if (!doc) {
    return;
  }

  await markDocumentOcrProcessing(db, { id: documentId });

  const storageSettings = await getStorageSettings();

  if (!storageSettings) {
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

  const storage = createS3Driver(storageSettings);
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
});
