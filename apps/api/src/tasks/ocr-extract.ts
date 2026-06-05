import { db } from "@omnipaper/database/client";
import {
  completeDocumentOcr,
  getDocumentById,
  markDocumentOcrProcessing,
} from "@omnipaper/database/queries/documents";
import { createMistralOcr } from "@omnipaper/ocr/mistral";
import { defineTask } from "@omnipaper/queue/worker";
import { getOcrSettings } from "@omnipaper/settings/ocr-settings";
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

  const ocrSettings = await getOcrSettings();

  if (!ocrSettings) {
    throw new Error("OCR is not configured");
  }

  const storage = createS3Driver(storageSettings);
  const ocr = createMistralOcr({ apiKey: ocrSettings.apiKey });

  const { url } = await storage.createDownloadUrl({ key: doc.storageKey });
  const { text } = await ocr.extract({ documentUrl: url, mimeType: doc.mimeType });

  await completeDocumentOcr(db, {
    id: documentId,
    organizationId: doc.organizationId,
    title: doc.title,
    text,
  });
});
