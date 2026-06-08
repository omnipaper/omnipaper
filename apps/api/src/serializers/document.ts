import type { getDocuments } from "@omnipaper/database/queries/documents";
import type { Document, DocumentType, StoragePath } from "@omnipaper/database/schema";
import type { toTagRefDto } from "./tag";

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

type TagRef = ReturnType<typeof toTagRefDto>;
type DocumentListRow = Awaited<ReturnType<typeof getDocuments>>[number];

// One row of `GET /documents`: the query's list-item row plus its embedded tags. Single source
// for the list/folder item shape (the web's DocumentRow is derived from this response).
export function toDocumentListItemDto(row: DocumentListRow, tags: TagRef[]) {
  return { ...row, tags };
}

// The full detail envelope for `GET /documents/:id`: the base document plus its tags, custom
// property values, and the assigned type/path (id + label only — the picker needs the id, the UI
// shows the name/path). Single source for the detail response shape.
export function toDocumentDetailDto(input: {
  document: Document;
  tags: TagRef[];
  customProperties: { definitionId: string; value: unknown }[];
  documentType: DocumentType | null | undefined;
  storagePath: StoragePath | null | undefined;
}) {
  return {
    ...toDocumentDto(input.document),
    tags: input.tags,
    customProperties: input.customProperties,
    documentType: input.documentType
      ? { id: input.documentType.id, name: input.documentType.name }
      : null,
    storagePath: input.storagePath
      ? { id: input.storagePath.id, path: input.storagePath.path }
      : null,
  };
}
