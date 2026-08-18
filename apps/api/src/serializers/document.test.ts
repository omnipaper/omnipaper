import { describe, expect, it } from "bun:test";
import { createTestDocument } from "../test/factories/document";
import { toDocumentDto } from "./document";

describe("toDocumentDto", () => {
  it("returns the document fields exposed by the API", () => {
    const dto = toDocumentDto(createTestDocument());

    expect(dto).toEqual({
      id: "doc_test_1",
      title: "Test document",
      originalFilename: "test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      ocrStatus: "pending",
      thumbnailStatus: "pending",
      ocrText: null,
      documentDate: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  it("allows a test to override only the relevant fields", () => {
    const dto = toDocumentDto(
      createTestDocument({
        title: "Invoice",
        ocrStatus: "completed",
        ocrText: "Invoice number: 123",
      }),
    );

    expect(dto.title).toBe("Invoice");
    expect(dto.ocrStatus).toBe("completed");
    expect(dto.ocrText).toBe("Invoice number: 123");
  });
});
