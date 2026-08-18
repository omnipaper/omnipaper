import { describe, expect, it } from "bun:test";
import { jobSchemas } from "./jobs";

describe("queue job payloads", () => {
  it("accepts payloads for document processing jobs", () => {
    expect(jobSchemas["ocr-extract"].safeParse({ documentId: "doc_1" }).success).toBe(true);
    expect(jobSchemas["text-extract"].safeParse({ documentId: "doc_1" }).success).toBe(true);
    expect(jobSchemas["thumbnail-generate"].safeParse({ documentId: "doc_1" }).success).toBe(true);
  });

  it("accepts all fields required by workflow jobs", () => {
    expect(
      jobSchemas["workflow-dispatch"].safeParse({
        documentId: "doc_1",
        trigger: "document.created",
        triggerEventId: "event_1",
      }).success,
    ).toBe(true);

    expect(
      jobSchemas["workflow-run"].safeParse({
        workflowId: "workflow_1",
        documentId: "doc_1",
        triggerEventId: "event_1",
      }).success,
    ).toBe(true);
  });

  it("accepts an empty payload for email-poll-dispatch", () => {
    expect(jobSchemas["email-poll-dispatch"].safeParse({}).success).toBe(true);
  });

  it("accepts an account id for email polling", () => {
    expect(jobSchemas["email-poll"].safeParse({ accountId: "account_1" }).success).toBe(true);
  });

  it("rejects empty required identifiers", () => {
    expect(jobSchemas["ocr-extract"].safeParse({ documentId: "" }).success).toBe(false);
    expect(jobSchemas["email-poll"].safeParse({ accountId: "" }).success).toBe(false);
    expect(jobSchemas["workflow-run"].safeParse({}).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(jobSchemas["workflow-dispatch"].safeParse({ documentId: "doc_1" }).success).toBe(false);
    expect(jobSchemas["ocr-extract"].safeParse({}).success).toBe(false);
  });
});
