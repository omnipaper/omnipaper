import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { OcrError } from "@omnipaper/ocr/resolve";
import type { Task } from "graphile-worker";

process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.ENCRYPTION_KEY ??= "test-encryption-key-123456";
process.env.AUTH_SECRET ??= "test-auth-secret";

const getDocumentById = mock(() =>
  Promise.resolve({
    id: "doc_1",
    organizationId: "org_1",
    title: "Invoice",
    storageKey: "org_1/doc_1",
    mimeType: "application/pdf",
    ocrStatus: "pending",
  }),
);
const markDocumentOcrProcessing = mock(() => Promise.resolve());
const markDocumentOcrFailed = mock(() => Promise.resolve());
const completeDocumentOcr = mock(() => Promise.resolve());
const extractText = mock(() => Promise.resolve({ text: "Invoice text" }));
const getOcrSettings = mock(() =>
  Promise.resolve({ definitionId: "mistral-ocr", model: "mistral-ocr-latest" }),
);
const getProviderKeys = mock(() => Promise.resolve({ mistral: "test-key" }));
const getAzureEndpoint = mock(() => Promise.resolve(undefined));
const getObject = mock(() =>
  Promise.resolve({
    body: new TextEncoder().encode("%PDF-1.4 test").buffer as ArrayBuffer,
    contentType: "application/pdf",
  }),
);
const enqueue = mock(() => Promise.resolve());
const taskLogger = { error: mock(() => {}) };

mock.module("@omnipaper/database/client", () => ({ db: {} }));
mock.module("@omnipaper/database/queries/documents", () => ({
  completeDocumentOcr,
  getDocumentById,
  markDocumentOcrFailed,
  markDocumentOcrProcessing,
}));
mock.module("@omnipaper/ocr/runner", () => ({ extractText }));
mock.module("@omnipaper/queue/producer", () => ({ enqueue }));
mock.module("@omnipaper/settings/ocr-settings", () => ({ getOcrSettings }));
mock.module("@omnipaper/settings/provider-settings", () => ({ getProviderKeys, getAzureEndpoint }));
mock.module("../lib/storage", () => ({
  getStorageDriver: mock(() => Promise.resolve({ getObject })),
}));
mock.module("../logger", () => ({ taskLogger }));
mock.module("@omnipaper/queue/worker", () => ({
  defineTask: mock((_name: string, handler: unknown) => handler),
}));

let ocrExtractTask: Task;

beforeAll(async () => {
  ({ ocrExtractTask } = await import("./ocr-extract"));
});

beforeEach(() => {
  getDocumentById.mockClear();
  markDocumentOcrProcessing.mockClear();
  markDocumentOcrFailed.mockClear();
  completeDocumentOcr.mockClear();
  extractText.mockReset();
  extractText.mockResolvedValue({ text: "Invoice text" });
  getOcrSettings.mockClear();
  getProviderKeys.mockClear();
  getAzureEndpoint.mockClear();
  getObject.mockClear();
  enqueue.mockClear();
  taskLogger.error.mockClear();
});

const helpers = (attempts: number, maxAttempts: number) =>
  ({
    job: {
      id: "job_1",
      attempts,
      max_attempts: maxAttempts,
    },
  }) as unknown as Parameters<Task>[1];

describe("ocrExtractTask", () => {
  it("rethrows a retryable OCR error while attempts remain", async () => {
    const error = new OcrError("temporary provider failure", { retryable: true });
    extractText.mockRejectedValue(error);

    await expect(ocrExtractTask({ documentId: "doc_1" }, helpers(1, 3))).rejects.toBe(error);

    expect(markDocumentOcrFailed).not.toHaveBeenCalled();
    expect(taskLogger.error).not.toHaveBeenCalled();
  });

  it("marks the document failed after a non-retryable error", async () => {
    extractText.mockRejectedValue(new Error("invalid provider request"));

    await ocrExtractTask({ documentId: "doc_1" }, helpers(1, 3));

    expect(markDocumentOcrFailed).toHaveBeenCalledWith({}, { id: "doc_1" });
  });

  it("marks the document failed when retryable attempts are exhausted", async () => {
    extractText.mockRejectedValue(new OcrError("provider unavailable", { retryable: true }));

    await ocrExtractTask({ documentId: "doc_1" }, helpers(3, 3));

    expect(markDocumentOcrFailed).toHaveBeenCalledWith({}, { id: "doc_1" });
  });
});
