import type { DocumentType } from "@omnipaper/database/schema";

export function toDocumentTypeDto(documentType: DocumentType) {
  return {
    id: documentType.id,
    name: documentType.name,
    description: documentType.description,
    createdAt: documentType.createdAt,
    updatedAt: documentType.updatedAt,
  };
}
