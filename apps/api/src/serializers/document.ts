import type { Document } from "@omnipaper/database/schema";

export function toDocumentDto(document: Document) {
  return {
    id: document.id,
    title: document.title,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    ocrStatus: document.ocrStatus,
    ocrText: document.ocrText,
    documentDate: document.documentDate,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
