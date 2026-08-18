import type { Document } from "@omnipaper/database/schema";

const TEST_DATE = new Date("2026-01-01T00:00:00.000Z");

export function createTestDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc_test_1",
    organizationId: "org_test_1",
    createdBy: "usr_test_1",
    title: "Test document",
    originalFilename: "test.pdf",
    storageKey: "org_test_1/doc_test_1",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    sha256: "test-sha256",
    ocrStatus: "pending",
    ocrText: null,
    thumbnailStatus: "pending",
    documentDate: null,
    documentTypeId: null,
    storagePathId: null,
    searchVector: "",
    createdAt: TEST_DATE,
    updatedAt: TEST_DATE,
    ...overrides,
  };
}
